"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { applicationStatusForKey, projectFieldsForKey } from "@/lib/workflow-core";
import { notifyProjectStage } from "@/lib/workflow";

export type MoveState =
  | { ok: true; at: number }
  | { ok: false; error: "invalid" | "forbidden" | "noteRequired" | "sameStage" | "notFound" | "inactive" | "locked" | "useWorkspace"; at: number }
  | undefined;

const fail = (error: Extract<MoveState, { ok: false }>["error"]): MoveState => ({ ok: false, error, at: Date.now() });

const moveSchema = z.object({
  entityId: z.string().min(1),
  stageId: z.string().min(1),
  note: z.string().trim(),
});

function refreshAll(paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/process");
  revalidatePath("/admin/workflow");
}

/**
 * Manual move of a project to any active PROJECT stage (ADMIN/root, note required).
 * A move to a system stage also updates the bound fields (stage / competition result) so every screen stays consistent;
 * a move to a custom stage changes nothing else.
 */
export async function moveProjectStage(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = moveSchema.safeParse({ entityId: formData.get("entityId"), stageId: formData.get("stageId"), note: formData.get("note") ?? "" });
  if (!parsed.success) return fail("invalid");
  const { entityId, stageId, note } = parsed.data;
  try {
    const access = await assertProjectAccess(user, entityId);
    if (!access.canManage) return fail("forbidden");
  } catch {
    return fail("forbidden");
  }
  if (note.length < 5 || note.length > 1000) return fail("noteRequired");

  const [project, target] = await Promise.all([
    prisma.project.findUnique({
      where: { id: entityId },
      select: { id: true, code: true, title: true, stage: true, result: true, workflowStageId: true, workflowStage: { select: { nameAz: true } } },
    }),
    prisma.workflowStage.findUnique({ where: { id: stageId }, select: { id: true, scope: true, systemKey: true, active: true, nameAz: true, nameTr: true, nameEn: true } }),
  ]);
  if (!project || !target || target.scope !== "PROJECT") return fail("notFound");
  if (!target.active) return fail("inactive");
  if (target.id === project.workflowStageId) return fail("sameStage");

  const fields = target.systemKey ? projectFieldsForKey(target.systemKey) : null;
  const stageChanged = !!fields?.stage && fields.stage !== project.stage;
  const resultChanged = !!fields?.result && fields.result !== project.result;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: { workflowStageId: target.id, ...(stageChanged ? { stage: fields!.stage } : {}), ...(resultChanged ? { result: fields!.result } : {}) },
    }),
    prisma.workflowTransition.create({
      data: { scope: "PROJECT", projectId: project.id, fromStageId: project.workflowStageId, toStageId: target.id, actorId: user.id, auto: false, note },
    }),
    ...(stageChanged
      ? [prisma.stageChange.create({ data: { projectId: project.id, fromStage: project.stage, toStage: fields!.stage!, note, actorId: user.id } })]
      : []),
  ]);
  await logAudit({
    actorId: user.id, action: "workflow.move", entity: "Project", entityId: project.id, projectId: project.id,
    summary: `${project.code}: ${project.workflowStage?.nameAz ?? "—"} → ${target.nameAz}`,
    meta: {
      from: project.workflowStageId, to: target.id, note,
      ...(stageChanged ? { stage: { from: project.stage, to: fields!.stage } } : {}),
      ...(resultChanged ? { result: { from: project.result, to: fields!.result } } : {}),
    },
  });
  await notifyProjectStage(project.id, project.title, target, user.id);
  refreshAll([`/projects/${project.id}`, "/projects", "/dashboard"]);
  revalidatePath(`/projects/${project.id}`, "layout");
  return { ok: true, at: Date.now() };
}

/**
 * Manual move of an application to an active APPLICATION stage (ADMIN/root, note required).
 * A system decision stage records the decision (status + rationale) exactly like the decision panel;
 * the workspace stage is reached only by creating the project workspace; decided-and-converted applications are locked
 * for system stages (they continue as a project).
 */
export async function moveApplicationStage(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = moveSchema.safeParse({ entityId: formData.get("entityId"), stageId: formData.get("stageId"), note: formData.get("note") ?? "" });
  if (!parsed.success) return fail("invalid");
  const { entityId, stageId, note } = parsed.data;

  const [app, target] = await Promise.all([
    prisma.application.findUnique({
      where: { id: entityId },
      select: { id: true, code: true, teamName: true, status: true, projectId: true, workflowStageId: true, workflowStage: { select: { nameAz: true } } },
    }),
    prisma.workflowStage.findUnique({ where: { id: stageId }, select: { id: true, scope: true, systemKey: true, active: true, nameAz: true } }),
  ]);
  if (!app || !target || target.scope !== "APPLICATION") return fail("notFound");
  if (!target.active) return fail("inactive");
  if (target.id === app.workflowStageId) return fail("sameStage");
  if (target.systemKey === "APP_WORKSPACE") return fail("useWorkspace");
  const status = target.systemKey ? applicationStatusForKey(target.systemKey) : null;
  if (status && app.projectId) return fail("locked");
  const isDecision = status === "ACCEPTED" || status === "WAITLIST" || status === "REJECTED";
  if (note.length < (isDecision ? 10 : 5) || note.length > 1000) return fail("noteRequired");

  await prisma.$transaction([
    prisma.application.update({
      where: { id: app.id },
      data: {
        workflowStageId: target.id,
        ...(status && status !== app.status ? { status } : {}),
        ...(isDecision && status !== app.status ? { decisionNote: note, decidedAt: new Date() } : {}),
      },
    }),
    prisma.workflowTransition.create({
      data: { scope: "APPLICATION", applicationId: app.id, fromStageId: app.workflowStageId, toStageId: target.id, actorId: user.id, auto: false, note },
    }),
  ]);
  await logAudit({
    actorId: user.id, action: "workflow.move", entity: "Application", entityId: app.id,
    summary: `${app.code} · ${app.teamName}: ${app.workflowStage?.nameAz ?? "—"} → ${target.nameAz}`,
    meta: { from: app.workflowStageId, to: target.id, note, ...(status && status !== app.status ? { status: { from: app.status, to: status } } : {}) },
  });
  refreshAll([`/applications/${app.id}`, "/applications"]);
  return { ok: true, at: Date.now() };
}
