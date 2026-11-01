import "server-only";
import { prisma } from "@/lib/db";
import { weightedScore } from "@/lib/kpi";
import { DISAGREEMENT_THRESHOLD, mean, spread } from "./scoring";

export type EvalKind = "MIDTERM" | "FINAL";
export const EVAL_KINDS: EvalKind[] = ["MIDTERM", "FINAL"];

/** `?kind=final` → FINAL, anything else → MIDTERM (ara jüri is the default). */
export function parseKind(v: string | string[] | undefined): EvalKind {
  return (Array.isArray(v) ? v[0] : v)?.toLowerCase() === "final" ? "FINAL" : "MIDTERM";
}

export async function getRubric(kind: EvalKind) {
  return prisma.rubric.findUnique({
    where: { kind },
    select: { id: true, kind: true, criteria: { orderBy: { order: "asc" }, select: { id: true, key: true, weight: true, maxScore: true } } },
  });
}

export type Rubric = NonNullable<Awaited<ReturnType<typeof getRubric>>>;

export type JurorStatus = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

type EvalRow = {
  evaluatorId: string;
  status: "DRAFT" | "SUBMITTED";
  submittedAt: Date | null;
  comment: string | null;
  recommendation: string | null;
  scores: { criterionId: string; score: number }[];
};

export type JurorAggregate = {
  id: string;
  name: string;
  title: string | null;
  assigned: boolean;
  status: JurorStatus;
  submittedAt: Date | null;
  /** only for SUBMITTED evaluations (drafts stay private to the juror) */
  scores: Record<string, number>;
  weighted: number | null;
  comment: string | null;
  recommendation: string | null;
};

export type Aggregate = {
  jurors: JurorAggregate[];
  assignedCount: number;
  submittedCount: number;
  draftCount: number;
  perCriterion: { id: string; key: string; weight: number; maxScore: number; avg: number | null; spread: number | null }[];
  weightedAvg: number | null;
  weightedSpread: number | null;
  disagreement: boolean;
};

/**
 * Aggregate evaluations of one project for one rubric. Only SUBMITTED evaluations are counted;
 * the result is informative (visibility for the human panel) and never a decision or ranking.
 */
export function aggregate(
  rubric: Rubric,
  assigned: { id: string; name: string; title: string | null }[],
  evaluations: (EvalRow & { evaluator: { id: string; name: string; title: string | null } })[],
): Aggregate {
  const byJuror = new Map<string, JurorAggregate>();
  for (const j of assigned) {
    byJuror.set(j.id, { id: j.id, name: j.name, title: j.title, assigned: true, status: "NOT_STARTED", submittedAt: null, scores: {}, weighted: null, comment: null, recommendation: null });
  }
  for (const e of evaluations) {
    const base = byJuror.get(e.evaluatorId) ?? {
      id: e.evaluator.id, name: e.evaluator.name, title: e.evaluator.title, assigned: false, status: "NOT_STARTED" as JurorStatus,
      submittedAt: null, scores: {}, weighted: null, comment: null, recommendation: null,
    };
    base.status = e.status;
    if (e.status === "SUBMITTED") {
      base.submittedAt = e.submittedAt;
      base.scores = Object.fromEntries(e.scores.map((s) => [s.criterionId, s.score]));
      base.weighted = weightedScore(rubric.criteria, base.scores);
      base.comment = e.comment?.trim() || null;
      base.recommendation = e.recommendation?.trim() || null;
    }
    byJuror.set(base.id, base);
  }
  const jurors = [...byJuror.values()].sort((a, b) => a.name.localeCompare(b.name));
  const submitted = jurors.filter((j) => j.status === "SUBMITTED");
  const perCriterion = rubric.criteria.map((c) => {
    const vals = submitted.map((j) => j.scores[c.id]).filter((v): v is number => typeof v === "number");
    return { ...c, avg: mean(vals), spread: spread(vals) };
  });
  const ws = submitted.map((j) => j.weighted!).filter((v) => typeof v === "number");
  const weightedSpread = spread(ws);
  return {
    jurors,
    assignedCount: jurors.filter((j) => j.assigned).length,
    submittedCount: submitted.length,
    draftCount: jurors.filter((j) => j.status === "DRAFT").length,
    perCriterion,
    weightedAvg: mean(ws),
    weightedSpread,
    disagreement: weightedSpread !== null && weightedSpread > DISAGREEMENT_THRESHOLD,
  };
}

export const evaluationSelect = {
  evaluatorId: true,
  status: true,
  submittedAt: true,
  comment: true,
  recommendation: true,
  scores: { select: { criterionId: true, score: true } },
  evaluator: { select: { id: true, name: true, title: true } },
} as const;

export async function getProjectAggregate(projectId: string, rubric: Rubric) {
  const [assignments, evaluations] = await Promise.all([
    prisma.juryAssignment.findMany({ where: { projectId }, select: { jury: { select: { id: true, name: true, title: true } } } }),
    prisma.evaluation.findMany({ where: { projectId, rubricId: rubric.id }, select: evaluationSelect }),
  ]);
  return aggregate(rubric, assignments.map((a) => a.jury), evaluations);
}
