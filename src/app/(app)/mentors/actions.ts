"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { currentWeek } from "@/lib/constants";
import { done, fail, formStr, formStrs, zodErrors, type ActionState } from "@/lib/actions";
import { bakuAddDays, bakuYmd, parseBakuDate, parseBakuDateTime } from "@/lib/dates";
import { revalidateProject, revalidateSets } from "@/lib/revalidate";

const ROLES = ["ADMIN", "TEAM", "MENTOR"] as const;

/** Pages that show sessions: mentors, calendar, dashboards, the project overview (next session) and sessions tab. */
function revalidateSessions(projectId: string) {
  revalidateSets("mentors", "calendar", "dashboard");
  revalidateProject(projectId, "sessions", "activity");
}

const idSchema = z.string().min(1).max(64);
const invalid = (error: z.ZodError) => fail("errors.invalid", zodErrors(error.issues));
/** A single-field rule error: inline under the field (no toast). */
const fieldFail = (field: string, key: string) => fail(key, { [field]: key });

async function access(user: CurrentUser, projectId: string) {
  try {
    return await assertProjectAccess(user, projectId);
  } catch {
    return null;
  }
}

async function teamMemberIds(projectId: string) {
  const members = await prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } });
  return members.map((m) => m.userId);
}

const planSchema = z.object({
  projectId: z.string().min(1, "errors.required"),
  mentorId: z.string().min(1, "errors.required"),
  scheduledAt: z.string().min(1, "errors.required"),
  durationMin: z.coerce.number().int().min(15, "errors.duration").max(240, "errors.duration"),
  topic: z.string().trim().min(3, "errors.topicLength").max(160, "errors.topicLength"),
  agenda: z.string().trim().max(2000, "errors.tooLong").optional().default(""),
  online: z.string().optional(),
});

/** Plan (ADMIN / MENTOR) or request (TEAM) a mentor session → PLANNED. */
export async function planSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  // before the meeting the team shares its agenda / progress → required for a team request
  if (user.role === "TEAM" && d.agenda.length < 3) return fieldFail("agenda", "errors.agendaRequired");
  const acc = await access(user, d.projectId);
  if (!acc?.canWork) return fail("errors.forbidden");
  if (user.role === "MENTOR" && d.mentorId !== user.id) return fail("errors.forbidden");
  const assigned = await prisma.mentorAssignment.findUnique({
    where: { projectId_mentorId: { projectId: d.projectId, mentorId: d.mentorId } },
    select: { id: true },
  });
  if (!assigned) return fieldFail("mentorId", "errors.mentorNotAssigned");
  const when = parseBakuDateTime(d.scheduledAt);
  if (!when) return fieldFail("scheduledAt", "errors.dateInvalid");
  if (when < new Date()) return fieldFail("scheduledAt", "errors.datePast");

  const session = await prisma.mentorSession.create({
    data: {
      projectId: d.projectId,
      mentorId: d.mentorId,
      scheduledAt: when,
      durationMin: d.durationMin,
      topic: d.topic,
      agenda: d.agenda || null,
      online: d.online === "on",
      status: "PLANNED",
    },
    select: { id: true, topic: true },
  });
  await logAudit({
    actorId: user.id,
    action: "session.create",
    entity: "MentorSession",
    entityId: session.id,
    projectId: d.projectId,
    summary: session.topic,
    meta: { requestedByTeam: user.role === "TEAM" },
  });
  const recipients = [...(await teamMemberIds(d.projectId)), d.mentorId].filter((id) => id !== user.id);
  await notify(recipients, "session_planned", { topic: session.topic }, `/projects/${d.projectId}/sessions`);
  revalidateSessions(d.projectId);
  return done(user.role === "TEAM" ? "toast.requested" : "toast.planned");
}

async function loadSession(id: string) {
  return prisma.mentorSession.findUnique({
    where: { id },
    select: { id: true, projectId: true, mentorId: true, status: true, topic: true, scheduledAt: true, nextSteps: true },
  });
}

/** session's own mentor or ADMIN */
function isSessionOwner(user: CurrentUser, s: { mentorId: string }) {
  return user.role === "ADMIN" || (user.role === "MENTOR" && s.mentorId === user.id);
}

export async function confirmSession(rawId: unknown): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return fail("errors.invalid");
  const id = parsed.data;
  const s = await loadSession(id);
  if (!s) return fail("errors.notFound");
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return fail("errors.forbidden");
  if (s.status !== "PLANNED") return fail("errors.wrongStatus");
  await prisma.mentorSession.update({ where: { id }, data: { status: "CONFIRMED" } });
  await logAudit({ actorId: user.id, action: "session.update", entity: "MentorSession", entityId: id, projectId: s.projectId, summary: s.topic, meta: { status: "CONFIRMED" } });
  revalidateSessions(s.projectId);
  return done("toast.confirmed");
}

export async function cancelSession(rawId: unknown): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return fail("errors.invalid");
  const id = parsed.data;
  const s = await loadSession(id);
  if (!s) return fail("errors.notFound");
  const acc = await access(user, s.projectId);
  // team may withdraw its own (not yet confirmed) request
  const allowed = isSessionOwner(user, s) || (user.role === "TEAM" && s.status === "PLANNED");
  if (!acc || !allowed) return fail("errors.forbidden");
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return fail("errors.wrongStatus");
  await prisma.mentorSession.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit({ actorId: user.id, action: "session.cancel", entity: "MentorSession", entityId: id, projectId: s.projectId, summary: s.topic });
  revalidateSessions(s.projectId);
  return done("toast.cancelled");
}

const rescheduleSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.string().min(1, "errors.required"),
  durationMin: z.coerce.number().int().min(15, "errors.duration").max(240, "errors.duration"),
});

export async function rescheduleSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const s = await loadSession(parsed.data.id);
  if (!s) return fail("errors.notFound");
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return fail("errors.forbidden");
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return fail("errors.wrongStatus");
  const when = parseBakuDateTime(parsed.data.scheduledAt);
  if (!when) return fieldFail("scheduledAt", "errors.dateInvalid");
  if (when < new Date()) return fieldFail("scheduledAt", "errors.datePast");
  await prisma.mentorSession.update({ where: { id: s.id }, data: { scheduledAt: when, durationMin: parsed.data.durationMin } });
  await logAudit({
    actorId: user.id,
    action: "session.update",
    entity: "MentorSession",
    entityId: s.id,
    projectId: s.projectId,
    summary: s.topic,
    meta: { from: s.scheduledAt.toISOString(), to: when.toISOString() },
  });
  const recipients = [...(await teamMemberIds(s.projectId)), s.mentorId].filter((id) => id !== user.id);
  await notify(recipients, "session_planned", { topic: s.topic }, `/projects/${s.projectId}/sessions`);
  revalidateSessions(s.projectId);
  return done("toast.rescheduled");
}

const agendaSchema = z.object({
  id: z.string().min(1),
  agenda: z.string().trim().min(3, "errors.agendaRequired").max(2000, "errors.tooLong"),
});

/** Before the meeting: the team (or mentor / admin) shares agenda & progress. */
export async function updateAgenda(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = agendaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const s = await loadSession(parsed.data.id);
  if (!s) return fail("errors.notFound");
  const acc = await access(user, s.projectId);
  if (!acc || !(isSessionOwner(user, s) || user.role === "TEAM")) return fail("errors.forbidden");
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return fail("errors.wrongStatus");
  await prisma.mentorSession.update({ where: { id: s.id }, data: { agenda: parsed.data.agenda } });
  await logAudit({ actorId: user.id, action: "session.update", entity: "MentorSession", entityId: s.id, projectId: s.projectId, summary: s.topic, meta: { field: "agenda" } });
  revalidateSessions(s.projectId);
  return done("toast.agendaSaved");
}

const completeSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().min(10, "errors.notesLength").max(4000, "errors.tooLong"),
});

/** After the meeting: the session's mentor (or admin) records advice + next steps → COMPLETED. */
export async function completeSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = completeSchema.safeParse({ id: formStr(formData, "id"), notes: formStr(formData, "notes") });
  if (!parsed.success) return invalid(parsed.error);
  const steps = formStrs(formData, "step")
    .map((v) => v.trim())
    .filter(Boolean);
  if (steps.length > 10) return fieldFail("steps", "errors.tooManySteps");
  if (steps.some((st) => st.length > 160)) return fieldFail("steps", "errors.stepLength");
  const s = await loadSession(parsed.data.id);
  if (!s) return fail("errors.notFound");
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return fail("errors.forbidden");
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return fail("errors.wrongStatus");
  await prisma.mentorSession.update({
    where: { id: s.id },
    data: { status: "COMPLETED", notes: parsed.data.notes, nextSteps: [...new Set(steps)] },
  });
  await logAudit({
    actorId: user.id,
    action: "session.complete",
    entity: "MentorSession",
    entityId: s.id,
    projectId: s.projectId,
    summary: s.topic,
    meta: { nextSteps: steps.length },
  });
  await notify((await teamMemberIds(s.projectId)).filter((id) => id !== user.id), "session_notes", { topic: s.topic }, `/projects/${s.projectId}/sessions`);
  revalidateSessions(s.projectId);
  return done("toast.completed");
}

/** Turn an agreed next step into a task (owner = project lead, due +7 days, MEDIUM, criterion = the step). */
const convertSchema = z.object({ sessionId: idSchema, index: z.number().int().min(0).max(99) });

export async function convertStep(rawSessionId: unknown, rawIndex: unknown): Promise<ActionState & { taskId?: string }> {
  const user = await requireUser([...ROLES]);
  const parsed = convertSchema.safeParse({ sessionId: rawSessionId, index: rawIndex });
  if (!parsed.success) return fail("errors.invalid");
  const { sessionId, index } = parsed.data;
  const s = await loadSession(sessionId);
  if (!s) return fail("errors.notFound");
  const acc = await access(user, s.projectId);
  if (!acc?.canWork) return fail("errors.forbidden");
  if (s.status !== "COMPLETED") return fail("errors.wrongStatus");
  const text = s.nextSteps[index]?.trim();
  if (!text) return fail("errors.notFound");

  const existing = await prisma.task.findFirst({ where: { sourceSessionId: s.id, title: text }, select: { id: true } });
  if (existing) return done("toast.converted", { taskId: existing.id });

  const lead =
    (await prisma.projectMember.findFirst({ where: { projectId: s.projectId, isLead: true }, select: { userId: true } })) ??
    (await prisma.projectMember.findFirst({ where: { projectId: s.projectId }, select: { userId: true } }));
  // 18:00 Baku time, seven Baku calendar days from today (same rule as tasks created in the task dialog)
  const due = parseBakuDate(bakuYmd(bakuAddDays(new Date(), 7)), "18:00")!;
  const week = currentWeek();
  const task = await prisma.task.create({
    data: {
      projectId: s.projectId,
      title: text,
      acceptanceCriteria: text,
      assigneeId: lead?.userId ?? null,
      createdById: user.id,
      dueDate: due,
      priority: "MEDIUM",
      sourceSessionId: s.id,
      week: week > 0 ? Math.min(8, week + 1) : null,
    },
    select: { id: true, title: true },
  });
  await logAudit({
    actorId: user.id,
    action: "session.convert_step",
    entity: "MentorSession",
    entityId: s.id,
    projectId: s.projectId,
    summary: task.title,
    meta: { taskId: task.id, step: index },
  });
  if (lead && lead.userId !== user.id) {
    await notify([lead.userId], "task_assigned", { title: task.title }, `/projects/${s.projectId}/tasks`);
  }
  revalidateSessions(s.projectId);
  revalidateSets("tasks", "projects");
  revalidateProject(s.projectId, "tasks");
  return done("toast.converted", { taskId: task.id });
}
