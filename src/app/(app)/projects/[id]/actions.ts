"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { STAGE_ORDER } from "@/lib/constants";
import { enumLabelByLocale } from "@/components/projects/server";

export type ManageState = { ok: true; at: number } | { ok: false; error: "invalid" | "forbidden" | "noteRequired" | "sameStage" | "notFound" | "duplicate"; at: number } | undefined;

const ok = (): ManageState => ({ ok: true, at: Date.now() });
const fail = (error: Extract<ManageState, { ok: false }>["error"]): ManageState => ({ ok: false, error, at: Date.now() });

/** Coordinator-only guard shared by every management action. */
async function manager(projectId: unknown) {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).parse(projectId);
  const access = await assertProjectAccess(user, id);
  if (!access.canManage) throw new Error("FORBIDDEN");
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, select: { id: true, code: true, title: true, stage: true, health: true } });
  return { user, project };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
}

const stageSchema = z.object({ toStage: z.enum(STAGE_ORDER), note: z.string().trim() });

export async function changeStage(_prev: ManageState, formData: FormData): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const parsed = stageSchema.safeParse({ toStage: formData.get("toStage"), note: formData.get("note") ?? "" });
  if (!parsed.success) return fail("invalid");
  const { toStage, note } = parsed.data;
  if (toStage === project.stage) return fail("sameStage");
  if (note.length < 5 || note.length > 1000) return fail("noteRequired");

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
  refresh(project.id);
  return ok();
}

const healthSchema = z.object({ health: z.enum(["ON_TRACK", "WATCH", "AT_RISK"]) });

export async function changeHealth(_prev: ManageState, formData: FormData): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const parsed = healthSchema.safeParse({ health: formData.get("health") });
  if (!parsed.success) return fail("invalid");
  if (parsed.data.health === project.health) return ok();
  await prisma.project.update({ where: { id: project.id }, data: { health: parsed.data.health } });
  await logAudit({
    actorId: user.id, action: "project.update", entity: "Project", entityId: project.id, projectId: project.id,
    summary: `${project.code}: health ${project.health} → ${parsed.data.health}`, meta: { field: "health", from: project.health, to: parsed.data.health },
  });
  refresh(project.id);
  return ok();
}

const flagsSchema = z.object({
  prototypeVerified: z.boolean(),
  packageQcPassed: z.boolean(),
  submittedAt: z.union([z.literal(""), z.iso.date()]),
  result: z.enum(["PENDING", "FINALIST", "NOT_SELECTED"]),
});

export async function updateFlags(_prev: ManageState, formData: FormData): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const parsed = flagsSchema.safeParse({
    prototypeVerified: formData.get("prototypeVerified") === "on",
    packageQcPassed: formData.get("packageQcPassed") === "on",
    submittedAt: formData.get("submittedAt") ?? "",
    result: formData.get("result"),
  });
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;
  const submittedAt = d.submittedAt ? new Date(`${d.submittedAt}T12:00:00+04:00`) : null;
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
  if ((before.submittedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(before.submittedAt) : "") !== (d.submittedAt || "")) changed.push(`submittedAt=${d.submittedAt || "—"}`);
  if (before.result !== d.result) changed.push(`result=${d.result}`);
  if (changed.length) {
    await logAudit({
      actorId: user.id, action: "project.flags", entity: "Project", entityId: project.id, projectId: project.id,
      summary: `${project.code}: ${changed.join(", ")}`, meta: { before: { ...before, submittedAt: before.submittedAt?.toISOString() ?? null }, after: d },
    });
  }
  refresh(project.id);
  return ok();
}

const assignSchema = z.object({ userId: z.string().min(1), focus: z.string().trim().max(60).optional() });

export async function assignMentor(_prev: ManageState, formData: FormData): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const parsed = assignSchema.safeParse({ userId: formData.get("userId"), focus: formData.get("focus") ?? undefined });
  if (!parsed.success) return fail("invalid");
  const mentor = await prisma.user.findFirst({ where: { id: parsed.data.userId, role: "MENTOR", active: true }, select: { id: true, name: true } });
  if (!mentor) return fail("notFound");
  const exists = await prisma.mentorAssignment.findUnique({ where: { projectId_mentorId: { projectId: project.id, mentorId: mentor.id } } });
  if (exists) return fail("duplicate");
  await prisma.mentorAssignment.create({ data: { projectId: project.id, mentorId: mentor.id, focus: parsed.data.focus || null } });
  await logAudit({ actorId: user.id, action: "project.assign_mentor", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${mentor.name}`, meta: { mentorId: mentor.id, focus: parsed.data.focus ?? null } });
  await notify([mentor.id], "assigned_project", { project: project.title }, `/projects/${project.id}`);
  refresh(project.id);
  return ok();
}

export async function unassignMentor(projectId: string, mentorId: string): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(projectId); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const row = await prisma.mentorAssignment.findUnique({
    where: { projectId_mentorId: { projectId: project.id, mentorId: String(mentorId) } }, include: { mentor: { select: { name: true } } },
  });
  if (!row) return fail("notFound");
  await prisma.mentorAssignment.delete({ where: { id: row.id } });
  await logAudit({ actorId: user.id, action: "project.unassign_mentor", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${row.mentor.name}`, meta: { mentorId: row.mentorId } });
  refresh(project.id);
  return ok();
}

export async function assignJury(_prev: ManageState, formData: FormData): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(formData.get("projectId")); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const parsed = assignSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fail("invalid");
  const juror = await prisma.user.findFirst({ where: { id: parsed.data.userId, role: "JURY", active: true }, select: { id: true, name: true } });
  if (!juror) return fail("notFound");
  const exists = await prisma.juryAssignment.findUnique({ where: { projectId_juryId: { projectId: project.id, juryId: juror.id } } });
  if (exists) return fail("duplicate");
  await prisma.juryAssignment.create({ data: { projectId: project.id, juryId: juror.id } });
  await logAudit({ actorId: user.id, action: "project.assign_jury", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${juror.name}`, meta: { juryId: juror.id } });
  await notify([juror.id], "assigned_project", { project: project.title }, `/projects/${project.id}`);
  refresh(project.id);
  return ok();
}

export async function unassignJury(projectId: string, juryId: string): Promise<ManageState> {
  let ctx;
  try { ctx = await manager(projectId); } catch { return fail("forbidden"); }
  const { user, project } = ctx;
  const row = await prisma.juryAssignment.findUnique({
    where: { projectId_juryId: { projectId: project.id, juryId: String(juryId) } }, include: { jury: { select: { name: true } } },
  });
  if (!row) return fail("notFound");
  await prisma.juryAssignment.delete({ where: { id: row.id } });
  await logAudit({ actorId: user.id, action: "project.unassign_jury", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${row.jury.name}`, meta: { juryId: row.juryId } });
  refresh(project.id);
  return ok();
}
