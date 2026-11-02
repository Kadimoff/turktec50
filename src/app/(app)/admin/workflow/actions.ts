"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { applicationStatusForKey, projectFieldsForKey } from "@/lib/workflow-core";
import type { WorkflowScope } from "@/generated/prisma/enums";

export type StageFormState =
  | { ok: true; at: number }
  | { ok: false; error: "invalid" | "system" | "hasItems" | "notFound" | "target"; fieldErrors?: Record<string, string>; at: number }
  | undefined;

const fail = (error: Extract<StageFormState, { ok: false }>["error"], fieldErrors?: Record<string, string>): StageFormState => ({ ok: false, error, fieldErrors, at: Date.now() });
const done = (): StageFormState => ({ ok: true, at: Date.now() });

const ROLES = ["TEAM", "ADMIN", "MENTOR", "JURY"] as const;
const KINDS = ["NORMAL", "DECISION", "WAITING", "REJECTED", "DONE"] as const;

const textSchema = z.object({
  nameAz: z.string().trim().min(2, "required").max(80, "tooLong"),
  nameTr: z.string().trim().max(80, "tooLong"),
  nameEn: z.string().trim().max(80, "tooLong"),
  descriptionAz: z.string().trim().max(400, "tooLong"),
  descriptionTr: z.string().trim().max(400, "tooLong"),
  descriptionEn: z.string().trim().max(400, "tooLong"),
  roles: z.array(z.enum(ROLES)).min(1, "required"),
});

function readText(fd: FormData) {
  return {
    nameAz: fd.get("nameAz") ?? "", nameTr: fd.get("nameTr") ?? "", nameEn: fd.get("nameEn") ?? "",
    descriptionAz: fd.get("descriptionAz") ?? "", descriptionTr: fd.get("descriptionTr") ?? "", descriptionEn: fd.get("descriptionEn") ?? "",
    roles: fd.getAll("roles"),
  };
}

function fieldErrorsOf(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0]);
    if (!out[k]) out[k] = i.message === "tooLong" ? "tooLong" : "required";
  }
  return out;
}

function textData(d: z.infer<typeof textSchema>) {
  return {
    nameAz: d.nameAz, nameTr: d.nameTr || d.nameAz, nameEn: d.nameEn || d.nameAz,
    descriptionAz: d.descriptionAz || null, descriptionTr: d.descriptionTr || null, descriptionEn: d.descriptionEn || null,
    responsibleRoles: [...new Set(d.roles)],
  };
}

function refresh() {
  revalidatePath("/admin/workflow");
  revalidatePath("/process");
}

/** Re-number a scope as 10, 20, 30… in the given id order. */
async function renumber(ids: string[]) {
  await prisma.$transaction(ids.map((id, i) => prisma.workflowStage.update({ where: { id }, data: { order: (i + 1) * 10 } })));
}

async function scopeIds(scope: WorkflowScope) {
  const rows = await prisma.workflowStage.findMany({ where: { scope }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  return rows.map((r) => r.id);
}

export async function createStage(_prev: StageFormState, fd: FormData): Promise<StageFormState> {
  const user = await requireUser(["ADMIN"]);
  const scope = z.enum(["APPLICATION", "PROJECT"]).safeParse(fd.get("scope"));
  const kind = z.enum(KINDS).safeParse(fd.get("kind"));
  const parsed = textSchema.safeParse(readText(fd));
  if (!scope.success || !kind.success) return fail("invalid");
  if (!parsed.success) return fail("invalid", fieldErrorsOf(parsed.error));
  const afterId = String(fd.get("afterId") ?? "");
  const ids = await scopeIds(scope.data);
  if (afterId && !ids.includes(afterId)) return fail("invalid");
  const stage = await prisma.workflowStage.create({
    data: { scope: scope.data, kind: kind.data, order: 0, systemKey: null, active: true, ...textData(parsed.data) },
    select: { id: true, nameAz: true },
  });
  const pos = afterId ? ids.indexOf(afterId) + 1 : 0;
  await renumber([...ids.slice(0, pos), stage.id, ...ids.slice(pos)]);
  await logAudit({ actorId: user.id, action: "workflow.stage_create", entity: "WorkflowStage", entityId: stage.id, summary: `${stage.nameAz} (${scope.data})`, meta: { scope: scope.data, kind: kind.data, afterId: afterId || null } });
  refresh();
  return done();
}

export async function updateStage(_prev: StageFormState, fd: FormData): Promise<StageFormState> {
  const user = await requireUser(["ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const stage = await prisma.workflowStage.findUnique({ where: { id }, select: { id: true, systemKey: true, kind: true, nameAz: true, nameTr: true, nameEn: true, descriptionAz: true, descriptionTr: true, descriptionEn: true, responsibleRoles: true } });
  if (!stage) return fail("notFound");
  const parsed = textSchema.safeParse(readText(fd));
  if (!parsed.success) return fail("invalid", fieldErrorsOf(parsed.error));
  // system stages keep their kind (it drives automatic moves and the diagram); only custom stages may change it
  let kind = stage.kind;
  if (!stage.systemKey && fd.get("kind")) {
    const k = z.enum(KINDS).safeParse(fd.get("kind"));
    if (!k.success) return fail("invalid");
    kind = k.data;
  }
  const data = { ...textData(parsed.data), kind };
  await prisma.workflowStage.update({ where: { id }, data });
  const before = { nameAz: stage.nameAz, nameTr: stage.nameTr, nameEn: stage.nameEn, roles: stage.responsibleRoles, kind: stage.kind };
  await logAudit({
    actorId: user.id, action: "workflow.stage_update", entity: "WorkflowStage", entityId: id,
    summary: stage.nameAz === data.nameAz ? data.nameAz : `${stage.nameAz} → ${data.nameAz}`,
    meta: { before, after: { nameAz: data.nameAz, nameTr: data.nameTr, nameEn: data.nameEn, roles: data.responsibleRoles, kind } },
  });
  refresh();
  return done();
}

export async function reorderStage(id: string, direction: "up" | "down"): Promise<StageFormState> {
  const user = await requireUser(["ADMIN"]);
  const stage = await prisma.workflowStage.findUnique({ where: { id: String(id) }, select: { id: true, scope: true, nameAz: true } });
  if (!stage || (direction !== "up" && direction !== "down")) return fail("notFound");
  const ids = await scopeIds(stage.scope);
  const i = ids.indexOf(stage.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return done();
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await renumber(ids);
  await logAudit({ actorId: user.id, action: "workflow.stage_reorder", entity: "WorkflowStage", entityId: stage.id, summary: `${stage.nameAz} · ${direction === "up" ? "↑" : "↓"} ${j + 1}/${ids.length}`, meta: { direction, position: j + 1 } });
  refresh();
  return done();
}

/** Move every project/application of `fromId` to `toId` (used before deactivating / deleting a custom stage). */
async function moveAllItems(fromId: string, toId: string, actorId: string, note: string) {
  const target = await prisma.workflowStage.findUniqueOrThrow({ where: { id: toId }, select: { id: true, systemKey: true } });
  const fields = target.systemKey ? projectFieldsForKey(target.systemKey) : null;
  const status = target.systemKey ? applicationStatusForKey(target.systemKey) : null;
  const projects = await prisma.project.findMany({ where: { workflowStageId: fromId }, select: { id: true, stage: true } });
  for (const p of projects) {
    const stageChanged = !!fields?.stage && fields.stage !== p.stage;
    await prisma.$transaction([
      prisma.project.update({ where: { id: p.id }, data: { workflowStageId: toId, ...(fields?.stage ? { stage: fields.stage } : {}), ...(fields?.result ? { result: fields.result } : {}) } }),
      prisma.workflowTransition.create({ data: { scope: "PROJECT", projectId: p.id, fromStageId: fromId, toStageId: toId, actorId, auto: false, note } }),
      ...(stageChanged ? [prisma.stageChange.create({ data: { projectId: p.id, fromStage: p.stage, toStage: fields!.stage!, note, actorId } })] : []),
    ]);
  }
  const apps = await prisma.application.findMany({ where: { workflowStageId: fromId }, select: { id: true, projectId: true } });
  for (const a of apps) {
    await prisma.$transaction([
      prisma.application.update({ where: { id: a.id }, data: { workflowStageId: toId, ...(status && !a.projectId ? { status } : {}) } }),
      prisma.workflowTransition.create({ data: { scope: "APPLICATION", applicationId: a.id, fromStageId: fromId, toStageId: toId, actorId, auto: false, note } }),
    ]);
  }
  return projects.length + apps.length;
}

async function prepareRemoval(id: string, moveToId: string) {
  const stage = await prisma.workflowStage.findUnique({
    where: { id },
    select: { id: true, scope: true, systemKey: true, nameAz: true, active: true, _count: { select: { projects: true, applications: true } } },
  });
  if (!stage) return { error: "notFound" as const };
  if (stage.systemKey) return { error: "system" as const };
  const items = stage._count.projects + stage._count.applications;
  if (items > 0) {
    if (!moveToId) return { error: "hasItems" as const };
    const target = await prisma.workflowStage.findUnique({ where: { id: moveToId }, select: { id: true, scope: true, active: true } });
    if (!target || target.id === stage.id || target.scope !== stage.scope || !target.active) return { error: "target" as const };
  }
  return { stage, items };
}

export async function setStageActive(_prev: StageFormState, fd: FormData): Promise<StageFormState> {
  const user = await requireUser(["ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "true";
  if (active) {
    const stage = await prisma.workflowStage.findUnique({ where: { id }, select: { id: true, nameAz: true, systemKey: true } });
    if (!stage) return fail("notFound");
    await prisma.workflowStage.update({ where: { id }, data: { active: true } });
    await logAudit({ actorId: user.id, action: "workflow.stage_activate", entity: "WorkflowStage", entityId: id, summary: stage.nameAz });
    refresh();
    return done();
  }
  const moveToId = String(fd.get("moveToId") ?? "");
  const r = await prepareRemoval(id, moveToId);
  if ("error" in r) return fail(r.error!);
  const moved = r.items > 0 ? await moveAllItems(id, moveToId, user.id, `${r.stage.nameAz}: deaktiv edildi`) : 0;
  await prisma.workflowStage.update({ where: { id }, data: { active: false } });
  await logAudit({ actorId: user.id, action: "workflow.stage_deactivate", entity: "WorkflowStage", entityId: id, summary: moved ? `${r.stage.nameAz} · ${moved} →` : r.stage.nameAz, meta: { moved, moveToId: moveToId || null } });
  refresh();
  return done();
}

export async function deleteStage(_prev: StageFormState, fd: FormData): Promise<StageFormState> {
  const user = await requireUser(["ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const moveToId = String(fd.get("moveToId") ?? "");
  const r = await prepareRemoval(id, moveToId);
  if ("error" in r) return fail(r.error!);
  const moved = r.items > 0 ? await moveAllItems(id, moveToId, user.id, `${r.stage.nameAz}: silindi`) : 0;
  await prisma.workflowStage.delete({ where: { id } });
  await renumber(await scopeIds(r.stage.scope));
  await logAudit({ actorId: user.id, action: "workflow.stage_delete", entity: "WorkflowStage", entityId: id, summary: r.stage.nameAz, meta: { moved, moveToId: moveToId || null } });
  refresh();
  return done();
}
