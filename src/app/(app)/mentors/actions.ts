"use server";
import { revalidatePath } from "next/cache";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { currentWeek } from "@/lib/constants";
import type { ActionState } from "@/components/mentors/types";

const ROLES = ["ADMIN", "TEAM", "MENTOR"] as const;

function revalidateSessions(projectId: string) {
  revalidatePath("/mentors");
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

async function access(user: CurrentUser, projectId: string) {
  try {
    return await assertProjectAccess(user, projectId);
  } catch {
    return null;
  }
}

/** datetime-local value "yyyy-MM-ddTHH:mm" interpreted in Baku time (UTC+4, no DST). */
function parseLocal(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message.startsWith("errors.") ? issue.message : "errors.invalid";
  }
  return out;
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
  if (!parsed.success) return { ok: false, error: "errors.invalid", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  // before the meeting the team shares its agenda / progress → required for a team request
  if (user.role === "TEAM" && d.agenda.length < 3) return { ok: false, fieldErrors: { agenda: "errors.agendaRequired" } };
  const acc = await access(user, d.projectId);
  if (!acc?.canWork) return { ok: false, error: "errors.forbidden" };
  if (user.role === "MENTOR" && d.mentorId !== user.id) return { ok: false, error: "errors.forbidden" };
  const assigned = await prisma.mentorAssignment.findUnique({
    where: { projectId_mentorId: { projectId: d.projectId, mentorId: d.mentorId } },
    select: { id: true },
  });
  if (!assigned) return { ok: false, fieldErrors: { mentorId: "errors.mentorNotAssigned" } };
  const when = parseLocal(d.scheduledAt);
  if (!when) return { ok: false, fieldErrors: { scheduledAt: "errors.dateInvalid" } };
  if (when < new Date()) return { ok: false, fieldErrors: { scheduledAt: "errors.datePast" } };

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
  return { ok: true };
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

export async function confirmSession(id: string): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const s = await loadSession(id);
  if (!s) return { ok: false, error: "errors.notFound" };
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "PLANNED") return { ok: false, error: "errors.wrongStatus" };
  await prisma.mentorSession.update({ where: { id }, data: { status: "CONFIRMED" } });
  await logAudit({ actorId: user.id, action: "session.update", entity: "MentorSession", entityId: id, projectId: s.projectId, summary: s.topic, meta: { status: "CONFIRMED" } });
  revalidateSessions(s.projectId);
  return { ok: true };
}

export async function cancelSession(id: string): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const s = await loadSession(id);
  if (!s) return { ok: false, error: "errors.notFound" };
  const acc = await access(user, s.projectId);
  // team may withdraw its own (not yet confirmed) request
  const allowed = isSessionOwner(user, s) || (user.role === "TEAM" && s.status === "PLANNED");
  if (!acc || !allowed) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return { ok: false, error: "errors.wrongStatus" };
  await prisma.mentorSession.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit({ actorId: user.id, action: "session.cancel", entity: "MentorSession", entityId: id, projectId: s.projectId, summary: s.topic });
  revalidateSessions(s.projectId);
  return { ok: true };
}

const rescheduleSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.string().min(1, "errors.required"),
  durationMin: z.coerce.number().int().min(15, "errors.duration").max(240, "errors.duration"),
});

export async function rescheduleSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "errors.invalid", fieldErrors: fieldErrors(parsed.error) };
  const s = await loadSession(parsed.data.id);
  if (!s) return { ok: false, error: "errors.notFound" };
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return { ok: false, error: "errors.wrongStatus" };
  const when = parseLocal(parsed.data.scheduledAt);
  if (!when) return { ok: false, fieldErrors: { scheduledAt: "errors.dateInvalid" } };
  if (when < new Date()) return { ok: false, fieldErrors: { scheduledAt: "errors.datePast" } };
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
  return { ok: true };
}

const agendaSchema = z.object({
  id: z.string().min(1),
  agenda: z.string().trim().min(3, "errors.agendaRequired").max(2000, "errors.tooLong"),
});

/** Before the meeting: the team (or mentor / admin) shares agenda & progress. */
export async function updateAgenda(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = agendaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const s = await loadSession(parsed.data.id);
  if (!s) return { ok: false, error: "errors.notFound" };
  const acc = await access(user, s.projectId);
  if (!acc || !(isSessionOwner(user, s) || user.role === "TEAM")) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return { ok: false, error: "errors.wrongStatus" };
  await prisma.mentorSession.update({ where: { id: s.id }, data: { agenda: parsed.data.agenda } });
  await logAudit({ actorId: user.id, action: "session.update", entity: "MentorSession", entityId: s.id, projectId: s.projectId, summary: s.topic, meta: { field: "agenda" } });
  revalidateSessions(s.projectId);
  return { ok: true };
}

const completeSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().min(10, "errors.notesLength").max(4000, "errors.tooLong"),
});

/** After the meeting: the session's mentor (or admin) records advice + next steps → COMPLETED. */
export async function completeSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...ROLES]);
  const parsed = completeSchema.safeParse({ id: formData.get("id"), notes: formData.get("notes") });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const steps = formData
    .getAll("step")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (steps.length > 10) return { ok: false, fieldErrors: { steps: "errors.tooManySteps" } };
  if (steps.some((st) => st.length > 160)) return { ok: false, fieldErrors: { steps: "errors.stepLength" } };
  const s = await loadSession(parsed.data.id);
  if (!s) return { ok: false, error: "errors.notFound" };
  if (!(await access(user, s.projectId)) || !isSessionOwner(user, s)) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "PLANNED" && s.status !== "CONFIRMED") return { ok: false, error: "errors.wrongStatus" };
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
  return { ok: true };
}

/** Turn an agreed next step into a task (owner = project lead, due +7 days, MEDIUM, criterion = the step). */
export async function convertStep(sessionId: string, index: number): Promise<ActionState & { taskId?: string }> {
  const user = await requireUser([...ROLES]);
  const s = await loadSession(sessionId);
  if (!s) return { ok: false, error: "errors.notFound" };
  const acc = await access(user, s.projectId);
  if (!acc?.canWork) return { ok: false, error: "errors.forbidden" };
  if (s.status !== "COMPLETED") return { ok: false, error: "errors.wrongStatus" };
  const text = s.nextSteps[index]?.trim();
  if (!text) return { ok: false, error: "errors.notFound" };

  const existing = await prisma.task.findFirst({ where: { sourceSessionId: s.id, title: text }, select: { id: true } });
  if (existing) return { ok: true, taskId: existing.id };

  const lead =
    (await prisma.projectMember.findFirst({ where: { projectId: s.projectId, isLead: true }, select: { userId: true } })) ??
    (await prisma.projectMember.findFirst({ where: { projectId: s.projectId }, select: { userId: true } }));
  const due = setMinutes(setHours(startOfDay(addDays(new Date(), 7)), 18), 0);
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
  revalidatePath("/tasks");
  return { ok: true, taskId: task.id };
}
