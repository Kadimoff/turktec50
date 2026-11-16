import "server-only";
import { prisma } from "@/lib/db";
import { logAudit, notify } from "@/lib/audit";
import type { Role, WorkflowScope, WorkflowStageKind } from "@/generated/prisma/enums";
import { deriveApplicationKey, deriveProjectKey } from "@/lib/workflow-core";

export type StageRecord = {
  id: string;
  scope: WorkflowScope;
  systemKey: string | null;
  nameAz: string; nameTr: string; nameEn: string;
  descriptionAz: string | null; descriptionTr: string | null; descriptionEn: string | null;
  order: number;
  kind: WorkflowStageKind;
  responsibleRoles: Role[];
  active: boolean;
};

export const STAGE_SELECT = {
  id: true, scope: true, systemKey: true, nameAz: true, nameTr: true, nameEn: true,
  descriptionAz: true, descriptionTr: true, descriptionEn: true, order: true, kind: true, responsibleRoles: true, active: true,
} as const;

/** Localized stage name (falls back to Azerbaijani). */
export function stageName(s: Pick<StageRecord, "nameAz" | "nameTr" | "nameEn">, locale: string) {
  return (locale === "tr" ? s.nameTr : locale === "en" ? s.nameEn : s.nameAz) || s.nameAz;
}

export function stageDescription(s: Pick<StageRecord, "descriptionAz" | "descriptionTr" | "descriptionEn">, locale: string) {
  return (locale === "tr" ? s.descriptionTr : locale === "en" ? s.descriptionEn : s.descriptionAz) || s.descriptionAz || "";
}

/** Side paths (waitlist / rejected) hang off the previous main-line stage; everything else is on the main line. */
export function isBranch(kind: WorkflowStageKind) {
  return kind === "WAITING" || kind === "REJECTED";
}

/** Active stages (optionally of one scope), ordered: applications first, then projects. */
export async function listStages(opts: { scope?: WorkflowScope; includeInactive?: boolean } = {}): Promise<StageRecord[]> {
  const rows = await prisma.workflowStage.findMany({
    where: { ...(opts.scope ? { scope: opts.scope } : {}), ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: STAGE_SELECT,
  });
  const rank = (s: WorkflowScope) => (s === "APPLICATION" ? 0 : 1);
  return rows.sort((a, b) => rank(a.scope) - rank(b.scope) || a.order - b.order);
}

/** Notify project members and mentors about a workflow stage change, each in their own language. */
export async function notifyProjectStage(projectId: string, projectTitle: string, stage: Pick<StageRecord, "nameAz" | "nameTr" | "nameEn">, exceptUserId: string | null) {
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      OR: [{ memberships: { some: { projectId } } }, { mentorAssignments: { some: { projectId } } }],
    },
    select: { id: true, locale: true },
  });
  const byLocale = new Map<string, string[]>();
  for (const r of recipients) byLocale.set(r.locale, [...(byLocale.get(r.locale) ?? []), r.id]);
  for (const [loc, ids] of byLocale) {
    await notify(ids, "stage_changed", { project: projectTitle, stage: stageName(stage, loc) }, `/projects/${projectId}`);
  }
}

/**
 * Automatic sync after an existing flow changed the bound enum (stage, result, decision, FINAL rubric…):
 * moves the project to the matching SYSTEM stage and records an automatic transition + audit entry.
 * Call only after a relevant event — custom stages are otherwise left alone (they are manual-only).
 */
export async function syncProjectWorkflow(projectId: string, actorId: string | null, note?: string | null) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true, code: true, title: true, stage: true, result: true, workflowStageId: true,
      workflowStage: { select: { nameAz: true } },
      evaluations: { where: { status: "SUBMITTED", rubric: { kind: "FINAL" } }, select: { id: true }, take: 1 },
    },
  });
  if (!p) return null;
  const key = deriveProjectKey({ stage: p.stage, result: p.result, hasFinalEval: p.evaluations.length > 0 });
  const target = await prisma.workflowStage.findUnique({ where: { systemKey: key }, select: { id: true, nameAz: true, nameTr: true, nameEn: true } });
  if (!target || target.id === p.workflowStageId) return null;
  await prisma.$transaction([
    prisma.project.update({ where: { id: p.id }, data: { workflowStageId: target.id } }),
    prisma.workflowTransition.create({
      data: { scope: "PROJECT", projectId: p.id, fromStageId: p.workflowStageId, toStageId: target.id, actorId, auto: true, note: note ?? null },
    }),
  ]);
  await logAudit({
    actorId, action: "workflow.auto", entity: "Project", entityId: p.id, projectId: p.id,
    summary: `${p.code}: ${p.workflowStage?.nameAz ?? "—"} → ${target.nameAz}`, meta: { from: p.workflowStageId, to: target.id, key, auto: true },
  });
  return target;
}

export async function syncApplicationWorkflow(applicationId: string, actorId: string | null, note?: string | null) {
  const a = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, code: true, status: true, projectId: true, workflowStageId: true, workflowStage: { select: { nameAz: true } } },
  });
  if (!a) return null;
  const key = deriveApplicationKey(a);
  const target = await prisma.workflowStage.findUnique({ where: { systemKey: key }, select: { id: true, nameAz: true } });
  if (!target || target.id === a.workflowStageId) return null;
  await prisma.$transaction([
    prisma.application.update({ where: { id: a.id }, data: { workflowStageId: target.id } }),
    prisma.workflowTransition.create({
      data: { scope: "APPLICATION", applicationId: a.id, fromStageId: a.workflowStageId, toStageId: target.id, actorId, auto: true, note: note ?? null },
    }),
  ]);
  await logAudit({
    actorId, action: "workflow.auto", entity: "Application", entityId: a.id,
    summary: `${a.code}: ${a.workflowStage?.nameAz ?? "—"} → ${target.nameAz}`, meta: { from: a.workflowStageId, to: target.id, key, auto: true },
  });
  return target;
}
