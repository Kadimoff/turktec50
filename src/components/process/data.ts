import "server-only";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { getProgramKpis } from "@/lib/kpi";
import { KPI_TARGETS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { listStages, stageDescription, stageName } from "@/lib/workflow";
import type { FunnelStat, ProcessData, StageItem, StreamStat } from "./types";

/**
 * Applications a user may see in the process view:
 * ADMIN and JURY see every application (same as /applications); TEAM / MENTOR only the application behind their project(s).
 */
export function applicationScope(user: CurrentUser): Prisma.ApplicationWhereInput {
  if (user.role === "ADMIN" || user.role === "JURY") return {};
  return { project: projectScope(user) };
}

/** Everything the /process page renders, filtered by role (rbac). Counts and lists never leak out-of-scope records. */
export async function getProcessData(user: CurrentUser, locale: string): Promise<ProcessData> {
  const pScope = projectScope(user);
  const aScope = applicationScope(user);
  const isAdmin = user.role === "ADMIN";

  const [stages, projects, applications, prjSince, appSince, sessions, sessionsDone, tasks, tasksDone, reqItems, reqApproved, openRisks, risksTotal] = await Promise.all([
    listStages(),
    prisma.project.findMany({
      where: pScope,
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true, workflowStageId: true, university: { select: { shortName: true } } },
    }),
    prisma.application.findMany({
      where: aScope,
      orderBy: { code: "asc" },
      select: { id: true, code: true, projectTitle: true, teamName: true, workflowStageId: true, university: { select: { shortName: true } } },
    }),
    prisma.workflowTransition.groupBy({ by: ["projectId", "toStageId"], where: { projectId: { not: null }, project: pScope }, _max: { createdAt: true } }),
    prisma.workflowTransition.groupBy({ by: ["applicationId", "toStageId"], where: { applicationId: { not: null }, application: aScope }, _max: { createdAt: true } }),
    prisma.mentorSession.count({ where: { project: pScope, status: { not: "CANCELLED" } } }),
    prisma.mentorSession.count({ where: { project: pScope, status: "COMPLETED" } }),
    prisma.task.count({ where: { project: pScope } }),
    prisma.task.count({ where: { project: pScope, status: "DONE" } }),
    prisma.checklistItem.count({ where: { project: pScope, required: true } }),
    prisma.checklistItem.count({ where: { project: pScope, required: true, status: "APPROVED" } }),
    prisma.risk.count({ where: { status: { not: "CLOSED" }, ...(isAdmin ? {} : { project: pScope }) } }),
    prisma.risk.count({ where: isAdmin ? {} : { project: pScope } }),
  ]);

  const since = new Map<string, Date>();
  for (const r of prjSince) if (r.projectId && r.toStageId && r._max.createdAt) since.set(`${r.projectId}:${r.toStageId}`, r._max.createdAt);
  for (const r of appSince) if (r.applicationId && r.toStageId && r._max.createdAt) since.set(`${r.applicationId}:${r.toStageId}`, r._max.createdAt);

  const items: Record<string, StageItem[]> = {};
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  const canOpenApplications = user.role === "ADMIN" || user.role === "JURY";
  for (const p of projects) {
    if (!p.workflowStageId) continue;
    counts.set(p.workflowStageId, (counts.get(p.workflowStageId) ?? 0) + 1);
    (items[p.workflowStageId] ??= []).push({
      id: p.id, code: p.code, title: p.title, sub: p.university.shortName, href: `/projects/${p.id}`,
      since: fmtDate(since.get(`${p.id}:${p.workflowStageId}`), locale),
    });
    if (user.role === "TEAM") mine.add(p.workflowStageId);
  }
  for (const a of applications) {
    if (!a.workflowStageId) continue;
    counts.set(a.workflowStageId, (counts.get(a.workflowStageId) ?? 0) + 1);
    (items[a.workflowStageId] ??= []).push({
      id: a.id, code: a.code, title: a.projectTitle, sub: `${a.teamName} · ${a.university.shortName}`, href: canOpenApplications ? `/applications/${a.id}` : null,
      since: fmtDate(since.get(`${a.id}:${a.workflowStageId}`), locale),
    });
    if (user.role === "TEAM") mine.add(a.workflowStageId);
  }

  const streams: StreamStat[] = [
    { key: "sessions", done: sessionsDone, total: sessions },
    { key: "tasks", done: tasksDone, total: tasks },
    { key: "checklist", done: reqApproved, total: reqItems },
    { key: "risks", done: openRisks, total: risksTotal },
  ];

  // KPI funnel: plan for everyone, actual program-wide numbers only for the coordinator (same rule as /kpi)
  const k = isAdmin ? await getProgramKpis() : null;
  const funnel: FunnelStat[] = [
    { key: "applicationsEvaluated", plan: KPI_TARGETS.applicationsEvaluated, actual: k?.applicationsEvaluated ?? null },
    { key: "teamsAccepted", plan: KPI_TARGETS.teamsAccepted, actual: k?.teamsAccepted ?? null },
    { key: "prototypes", plan: KPI_TARGETS.prototypes, actual: k?.prototypes ?? null },
    { key: "qcPackages", plan: KPI_TARGETS.qcPackages, actual: k?.qcPackages ?? null },
    { key: "finalists", plan: KPI_TARGETS.finalists, actual: k?.finalists ?? null },
  ];

  return {
    stages: stages.map((s) => ({
      id: s.id, scope: s.scope, systemKey: s.systemKey, name: stageName(s, locale), description: stageDescription(s, locale),
      kind: s.kind, roles: s.responsibleRoles, count: counts.get(s.id) ?? 0, mine: mine.has(s.id),
    })),
    items,
    streams,
    funnel,
    generatedAt: new Date().toISOString(),
    generatedLabel: fmtDate(new Date(), locale),
  };
}
