"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { weightedScore } from "@/lib/kpi";

const schema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["MIDTERM", "FINAL"]),
  intent: z.enum(["save", "submit"]),
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  comment: z.string().trim().max(3000).optional().default(""),
  recommendation: z.string().trim().max(1500).optional().default(""),
});

export type SaveEvaluationResult =
  | { ok: true; status: "DRAFT" | "SUBMITTED"; submittedAt: string | null }
  | { ok: false; error: "forbidden" | "invalid" | "incomplete" | "locked" | "error" };

/** Save a draft or submit a jury evaluation (MIDTERM / FINAL rubric) for one project. Submitted evaluations are locked. */
export async function saveEvaluation(input: z.input<typeof schema>): Promise<SaveEvaluationResult> {
  const user = await requireUser(["ADMIN", "JURY"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { projectId, kind, intent, comment, recommendation } = parsed.data;

  let access;
  try {
    access = await assertProjectAccess(user, projectId);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!access.canEvaluate) return { ok: false, error: "forbidden" };

  const rubric = await prisma.rubric.findUnique({
    where: { kind },
    select: { id: true, criteria: { select: { id: true, weight: true, maxScore: true } } },
  });
  if (!rubric) return { ok: false, error: "invalid" };

  // keep only known criteria, enforce each criterion's own max score
  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const s = parsed.data.scores[c.id];
    if (typeof s !== "number") continue;
    if (s < 1 || s > c.maxScore) return { ok: false, error: "invalid" };
    scores[c.id] = s;
  }
  if (intent === "submit" && Object.keys(scores).length !== rubric.criteria.length) return { ok: false, error: "incomplete" };

  const key = { rubricId_evaluatorId_projectId: { rubricId: rubric.id, evaluatorId: user.id, projectId } };
  const existing = await prisma.evaluation.findUnique({ where: key, select: { status: true } });
  if (existing?.status === "SUBMITTED") return { ok: false, error: "locked" };

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true, code: true } });
  const status = intent === "submit" ? "SUBMITTED" : "DRAFT";
  const submittedAt = intent === "submit" ? new Date() : null;

  try {
    const evaluation = await prisma.$transaction(async (tx) => {
      const ev = await tx.evaluation.upsert({
        where: key,
        create: { rubricId: rubric.id, evaluatorId: user.id, projectId, status, submittedAt, comment: comment || null, recommendation: recommendation || null },
        update: { status, submittedAt, comment: comment || null, recommendation: recommendation || null },
        select: { id: true },
      });
      // replace the score set (a draft may remove a score again)
      await tx.evaluationScore.deleteMany({ where: { evaluationId: ev.id, criterionId: { notIn: Object.keys(scores) } } });
      for (const [criterionId, score] of Object.entries(scores)) {
        await tx.evaluationScore.upsert({
          where: { evaluationId_criterionId: { evaluationId: ev.id, criterionId } },
          create: { evaluationId: ev.id, criterionId, score },
          update: { score },
        });
      }
      return ev;
    });

    const total = weightedScore(rubric.criteria, scores);
    await logAudit({
      actorId: user.id,
      action: intent === "submit" ? "evaluation.submit" : "evaluation.save",
      entity: "Evaluation",
      entityId: evaluation.id,
      projectId,
      summary: `${project.code} · ${project.title} · ${kind}`,
      meta: { kind, scored: Object.keys(scores).length, of: rubric.criteria.length, weighted: total },
    });

    if (intent === "submit") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
      await notify(
        admins.map((a) => a.id).filter((id) => id !== user.id),
        "evaluation_submitted",
        { project: project.title },
        `/projects/${projectId}/evaluations${kind === "FINAL" ? "?kind=final" : ""}`,
      );
    }
  } catch {
    return { ok: false, error: "error" };
  }

  revalidatePath(`/projects/${projectId}/evaluations`);
  revalidatePath("/jury");
  return { ok: true, status, submittedAt: submittedAt?.toISOString() ?? null };
}
