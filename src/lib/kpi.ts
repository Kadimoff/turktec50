import "server-only";
import { prisma } from "@/lib/db";
import { KPI_TARGETS } from "@/lib/constants";

/**
 * Program KPI snapshot, computed from records (Annex B definitions). Never estimated.
 * - applicationsEvaluated: unique applications with >=1 SUBMITTED selection evaluation
 * - teamsAccepted: accepted applications converted into projects
 * - prototypes: projects with verified functional prototype/MVP (test evidence)
 * - qcPackages: projects whose application package passed the QC checklist
 * - finalists: projects officially announced as finalist
 */
export async function getProgramKpis() {
  const [applicationsTotal, applicationsEvaluated, teamsAccepted, prototypes, qcPackages, submitted, finalists] =
    await Promise.all([
      prisma.application.count(),
      prisma.application.count({ where: { evaluations: { some: { status: "SUBMITTED" } } } }),
      prisma.project.count(),
      prisma.project.count({ where: { prototypeVerified: true } }),
      prisma.project.count({ where: { packageQcPassed: true } }),
      prisma.project.count({ where: { submittedAt: { not: null } } }),
      prisma.project.count({ where: { result: "FINALIST" } }),
    ]);
  return {
    applicationsTotal,
    applicationsEvaluated,
    teamsAccepted,
    prototypes,
    qcPackages,
    submitted,
    finalists,
    targets: KPI_TARGETS,
  };
}

/** Readiness % of a project = approved required checklist items / required items. */
export function readinessFromChecklist(items: { required: boolean; status: string }[]) {
  const req = items.filter((i) => i.required);
  if (req.length === 0) return 0;
  return Math.round((req.filter((i) => i.status === "APPROVED").length / req.length) * 100);
}

/** Weighted rubric score normalized to 0–100. scores: criterionId -> score; criteria with weight & maxScore. */
export function weightedScore(
  criteria: { id: string; weight: number; maxScore: number }[],
  scores: Record<string, number>,
) {
  let total = 0;
  for (const c of criteria) {
    const s = scores[c.id];
    if (typeof s === "number") total += (s / c.maxScore) * c.weight;
  }
  return Math.round(total * 10) / 10;
}
