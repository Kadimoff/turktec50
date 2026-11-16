"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { STAGE_ORDER } from "@/lib/constants";
import { done, fail, failFromZod, formStr, isUniqueViolation, RuleError, type ActionState } from "@/lib/actions";
import { assertFacultyUsable } from "@/lib/academy/rules";
import { bakuYmd, parseBakuDate } from "@/lib/dates";
import { revalidateProject, revalidateSets } from "@/lib/revalidate";
import { enumLabelByLocale } from "@/components/projects/server";

// Every result is an ActionState whose `message` / `errors` are keys of the `projects.manage` namespace.

/** Coordinator-only guard shared by every management action. */
async function manager(projectId: unknown) {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).parse(projectId);
  const access = await assertProjectAccess(user, id);
  if (!access.canManage) throw new Error("FORBIDDEN");
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, select: { id: true, code: true, title: true, stage: true, health: true } });
  return { user, project };
}

/** The project header (stage, health, result badges) is rendered by the layout of every tab. */
function refreshAll(projectId: string) {
  revalidateProject(projectId, "tasks", "sessions", "documents", "risks", "resources", "evaluations", "activity");
  revalidateSets("projects", "dashboard");
}

/** Overview + activity only (assignments, academy links). */
function refreshOverview(projectId: string, ...extra: Parameters<typeof revalidateSets>) {
  revalidateProject(projectId, "activity");
  revalidateSets("projects", ...extra);
}

const stageSchema = z.object({
  toStage: z.enum(STAGE_ORDER, { message: "errors.invalid" }),
  note: z.string().trim().min(5, "errors.noteRequired").max(1000, "errors.noteRequired"),
});

export async function changeStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = stageSchema.safeParse({ toStage: formStr(formData, "toStage"), note: formStr(formData, "note") ?? "" });
  if (!parsed.success) return failFromZod(parsed.error);
  const { toStage, note } = parsed.data;
  if (toStage === project.stage) return fail("errors.sameStage", { toStage: "errors.sameStage" });

  await prisma.$transaction([
    prisma.project.update({ where: { id: project.id }, data: { stage: toStage } }),
    prisma.stageChange.create({ data: { projectId: project.id, fromStage: project.stage, toStage, note, actorId: user.id } }),
  ]);
  await logAudit({
    actorId: user.id, action: "project.stage", entity: "Project", entityId: project.id, projectId: project.id,
    summary: `${project.code}: ${project.stage} → ${toStage}`, meta: { from: project.stage, to: toStage, note },
  });

  // notify team members (+ assigned mentors), each in their own language
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      id: { not: user.id },
      OR: [{ memberships: { some: { projectId: project.id } } }, { mentorAssignments: { some: { projectId: project.id } } }],
    },
    select: { id: true, locale: true },
  });
  const labels = await enumLabelByLocale("ProjectStage", toStage);
  const byLocale = new Map<string, string[]>();
  for (const r of recipients) byLocale.set(r.locale, [...(byLocale.get(r.locale) ?? []), r.id]);
  for (const [loc, ids] of byLocale) {
    await notify(ids, "stage_changed", { project: project.title, stage: labels[loc] ?? labels.az ?? toStage }, `/projects/${project.id}`);
  }
  refreshAll(project.id);
  return done("stageSaved");
}

const healthSchema = z.object({ health: z.enum(["ON_TRACK", "WATCH", "AT_RISK"], { message: "errors.invalid" }) });

export async function changeHealth(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = healthSchema.safeParse({ health: formStr(formData, "health") });
  if (!parsed.success) return failFromZod(parsed.error);
  if (parsed.data.health === project.health) return done("healthSaved");
  await prisma.project.update({ where: { id: project.id }, data: { health: parsed.data.health } });
  await logAudit({
    actorId: user.id, action: "project.update", entity: "Project", entityId: project.id, projectId: project.id,
    summary: `${project.code}: health ${project.health} → ${parsed.data.health}`, meta: { field: "health", from: project.health, to: parsed.data.health },
  });
  refreshAll(project.id);
  return done("healthSaved");
}

const flagsSchema = z.object({
  prototypeVerified: z.boolean(),
  packageQcPassed: z.boolean(),
  submittedAt: z.union([z.literal(""), z.iso.date()], { message: "errors.date" }),
  result: z.enum(["PENDING", "FINALIST", "NOT_SELECTED"], { message: "errors.invalid" }),
});

export async function updateFlags(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = flagsSchema.safeParse({
    prototypeVerified: formData.get("prototypeVerified") === "on",
    packageQcPassed: formData.get("packageQcPassed") === "on",
    submittedAt: formStr(formData, "submittedAt") ?? "",
    result: formStr(formData, "result"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;
  // the application date is a Baku calendar day (stored at 12:00 Baku)
  const submittedAt = d.submittedAt ? parseBakuDate(d.submittedAt) : null;
  if (d.submittedAt && !submittedAt) return fail("errors.date", { submittedAt: "errors.date" });
  const before = await prisma.project.findUniqueOrThrow({
    where: { id: project.id }, select: { prototypeVerified: true, packageQcPassed: true, submittedAt: true, result: true },
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { prototypeVerified: d.prototypeVerified, packageQcPassed: d.packageQcPassed, submittedAt, result: d.result },
  });
  const changed: string[] = [];
  if (before.prototypeVerified !== d.prototypeVerified) changed.push(`prototypeVerified=${d.prototypeVerified}`);
  if (before.packageQcPassed !== d.packageQcPassed) changed.push(`packageQcPassed=${d.packageQcPassed}`);
  if (bakuYmd(before.submittedAt) !== d.submittedAt) changed.push(`submittedAt=${d.submittedAt || "—"}`);
  if (before.result !== d.result) changed.push(`result=${d.result}`);
  if (changed.length) {
    await logAudit({
      actorId: user.id, action: "project.flags", entity: "Project", entityId: project.id, projectId: project.id,
      summary: `${project.code}: ${changed.join(", ")}`, meta: { before: { ...before, submittedAt: before.submittedAt?.toISOString() ?? null }, after: d },
    });
  }
  refreshAll(project.id);
  return done("flagsSaved");
}

const academySchema = z.object({ facultyId: z.string().trim(), labId: z.string().trim(), partnerId: z.string().trim() });

/** Academy links: faculty (of the project's university), lab, industry partner — each optional. */
export async function updateAcademyLinks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = academySchema.safeParse({
    facultyId: formStr(formData, "facultyId") ?? "",
    labId: formStr(formData, "labId") ?? "",
    partnerId: formStr(formData, "partnerId") ?? "",
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const next = { facultyId: parsed.data.facultyId || null, labId: parsed.data.labId || null, partnerId: parsed.data.partnerId || null };

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const before = await tx.project.findUniqueOrThrow({
        where: { id: project.id },
        select: {
          universityId: true, facultyId: true, labId: true, partnerId: true,
          faculty: { select: { name: true } }, lab: { select: { name: true } }, partner: { select: { name: true } },
        },
      });
      // a newly chosen value must be selectable: faculty of the same university and not archived, any lab, partner not archived
      await assertFacultyUsable(tx, next.facultyId, before.universityId, before.facultyId);
      const [faculty, lab, partner] = await Promise.all([
        next.facultyId ? tx.faculty.findUnique({ where: { id: next.facultyId }, select: { name: true } }) : null,
        next.labId ? tx.lab.findUnique({ where: { id: next.labId }, select: { name: true } }) : null,
        next.partnerId ? tx.partner.findUnique({ where: { id: next.partnerId }, select: { name: true, status: true } }) : null,
      ]);
      if (next.labId && !lab) throw new RuleError("errors.invalid", "labId");
      if (next.partnerId && (!partner || (partner.status === "ARCHIVED" && next.partnerId !== before.partnerId))) throw new RuleError("errors.invalid", "partnerId");

      const changed: string[] = [];
      if (before.facultyId !== next.facultyId) changed.push(`faculty=${faculty?.name ?? "—"}`);
      if (before.labId !== next.labId) changed.push(`lab=${lab?.name ?? "—"}`);
      if (before.partnerId !== next.partnerId) changed.push(`partner=${partner?.name ?? "—"}`);
      if (changed.length) await tx.project.update({ where: { id: project.id }, data: next });
      return { before, changed, names: { faculty: faculty?.name ?? null, lab: lab?.name ?? null, partner: partner?.name ?? null } };
    });
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key, e.field ? { [e.field]: e.key } : undefined);
    throw e;
  }
  const { before, changed, names } = result;
  if (changed.length === 0) return done("academySaved");

  await logAudit({
    actorId: user.id, action: "project.academy", entity: "Project", entityId: project.id, projectId: project.id,
    summary: `${project.code}: ${changed.join(", ")}`,
    meta: {
      from: { facultyId: before.facultyId, labId: before.labId, partnerId: before.partnerId, faculty: before.faculty?.name ?? null, lab: before.lab?.name ?? null, partner: before.partner?.name ?? null },
      to: { ...next, ...names },
    },
  });
  refreshOverview(project.id, "academy");
  return done("academySaved");
}

const assignSchema = z.object({ userId: z.string().min(1, "errors.required"), focus: z.string().trim().max(60, "errors.invalid").optional() });

export async function assignMentor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = assignSchema.safeParse({ userId: formStr(formData, "userId") ?? "", focus: formStr(formData, "focus") });
  if (!parsed.success) return failFromZod(parsed.error);
  const mentor = await prisma.user.findFirst({ where: { id: parsed.data.userId, role: "MENTOR", active: true }, select: { id: true, name: true } });
  if (!mentor) return fail("errors.notFound", { userId: "errors.notFound" });
  try {
    await prisma.mentorAssignment.create({ data: { projectId: project.id, mentorId: mentor.id, focus: parsed.data.focus || null } });
  } catch (e) {
    // already assigned (also when two coordinators assign the same mentor at the same moment)
    if (isUniqueViolation(e)) return fail("errors.duplicate", { userId: "errors.duplicate" });
    throw e;
  }
  await logAudit({ actorId: user.id, action: "project.assign_mentor", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${mentor.name}`, meta: { mentorId: mentor.id, focus: parsed.data.focus ?? null } });
  await notify([mentor.id], "assigned_project", { project: project.title }, `/projects/${project.id}`);
  refreshOverview(project.id, "mentors", "dashboard");
  return done("mentorAssigned");
}

export async function unassignMentor(projectId: string, mentorId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(projectId); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const id = z.string().min(1).safeParse(mentorId);
  if (!id.success) return fail("errors.invalid");
  const row = await prisma.mentorAssignment.findUnique({
    where: { projectId_mentorId: { projectId: project.id, mentorId: id.data } }, include: { mentor: { select: { name: true } } },
  });
  if (!row) return fail("errors.notFound");
  await prisma.mentorAssignment.delete({ where: { id: row.id } });
  await logAudit({ actorId: user.id, action: "project.unassign_mentor", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${row.mentor.name}`, meta: { mentorId: row.mentorId } });
  refreshOverview(project.id, "mentors", "dashboard");
  return done("unassigned");
}

export async function assignJury(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const parsed = assignSchema.safeParse({ userId: formStr(formData, "userId") ?? "" });
  if (!parsed.success) return failFromZod(parsed.error);
  const juror = await prisma.user.findFirst({ where: { id: parsed.data.userId, role: "JURY", active: true }, select: { id: true, name: true } });
  if (!juror) return fail("errors.notFound", { userId: "errors.notFound" });
  try {
    await prisma.juryAssignment.create({ data: { projectId: project.id, juryId: juror.id } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("errors.duplicate", { userId: "errors.duplicate" });
    throw e;
  }
  await logAudit({ actorId: user.id, action: "project.assign_jury", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${juror.name}`, meta: { juryId: juror.id } });
  await notify([juror.id], "assigned_project", { project: project.title }, `/projects/${project.id}`);
  refreshOverview(project.id, "jury", "dashboard");
  revalidateProject(project.id, "evaluations");
  return done("juryAssigned");
}

export async function unassignJury(projectId: string, juryId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await manager(projectId); } catch { return fail("errors.forbidden"); }
  const { user, project } = ctx;
  const id = z.string().min(1).safeParse(juryId);
  if (!id.success) return fail("errors.invalid");
  const row = await prisma.juryAssignment.findUnique({
    where: { projectId_juryId: { projectId: project.id, juryId: id.data } }, include: { jury: { select: { name: true } } },
  });
  if (!row) return fail("errors.notFound");
  await prisma.juryAssignment.delete({ where: { id: row.id } });
  await logAudit({ actorId: user.id, action: "project.unassign_jury", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${row.jury.name}`, meta: { juryId: row.juryId } });
  refreshOverview(project.id, "jury", "dashboard");
  revalidateProject(project.id, "evaluations");
  return done("unassigned");
}
