"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { weightedScore } from "@/lib/kpi";
import { done, fail, isUniqueViolation, RuleError, type ActionState } from "@/lib/actions";
import { revalidateProject, revalidateSets } from "@/lib/revalidate";

const schema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["MIDTERM", "FINAL"]),
  intent: z.enum(["save", "submit"]),
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  comment: z.string().trim().max(3000).optional().default(""),
  recommendation: z.string().trim().max(1500).optional().default(""),
});

/** `message` is a key of the `jury` namespace; on success the saved status is returned. */
export type SaveEvaluationResult = ActionState & { status?: "DRAFT" | "SUBMITTED"; submittedAt?: string | null };

/** Save a draft or submit a jury evaluation (MIDTERM / FINAL rubric) for one project. Submitted evaluations are locked. */
export async function saveEvaluation(input: z.input<typeof schema>): Promise<SaveEvaluationResult> {
  const user = await requireUser(["ADMIN", "JURY"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("form.errors.invalid");
  const { projectId, kind, intent, comment, recommendation } = parsed.data;

  let access;
  try {
    access = await assertProjectAccess(user, projectId);
  } catch {
    return fail("form.errors.forbidden");
  }
  if (!access.canEvaluate) return fail("form.errors.forbidden");

  const rubric = await prisma.rubric.findUnique({
    where: { kind },
    select: { id: true, criteria: { select: { id: true, weight: true, maxScore: true } } },
  });
  if (!rubric) return fail("form.errors.invalid");

  // keep only known criteria, enforce each criterion's own max score
  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const s = parsed.data.scores[c.id];
    if (typeof s !== "number") continue;
    if (s < 1 || s > c.maxScore) return fail("form.errors.invalid");
    scores[c.id] = s;
  }
  if (intent === "submit" && Object.keys(scores).length !== rubric.criteria.length) return fail("form.errors.incomplete");

  const owner = { rubricId: rubric.id, evaluatorId: user.id, projectId };
  const key = { rubricId_evaluatorId_projectId: owner };

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true, code: true } });
  const status: "DRAFT" | "SUBMITTED" = intent === "submit" ? "SUBMITTED" : "DRAFT";
  const submittedAt = intent === "submit" ? new Date() : null;

  try {
    const evaluation = await prisma.$transaction(async (tx) => {
      const data = { status, submittedAt, comment: comment || null, recommendation: recommendation || null };
      // the lock is part of the write: only a not-yet-submitted evaluation is updated (a concurrent submit wins)
      const updated = await tx.evaluation.updateMany({ where: { ...owner, status: { not: "SUBMITTED" } }, data });
      let ev: { id: string };
      if (updated.count === 0) {
        if (await tx.evaluation.findUnique({ where: key, select: { id: true } })) throw new RuleError("form.errors.locked");
        ev = await tx.evaluation.create({ data: { ...owner, ...data }, select: { id: true } });
      } else {
        ev = await tx.evaluation.findUniqueOrThrow({ where: key, select: { id: true } });
      }
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
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key);
    // the first save of two parallel requests created the row: the user can simply save again
    return fail(isUniqueViolation(e) ? "form.errors.retry" : "form.errors.error");
  }

  revalidateProject(projectId, "evaluations");
  revalidateSets("jury", "dashboard");
  return done(intent === "submit" ? "form.toastSubmitted" : "form.toastSaved", { status, submittedAt: submittedAt?.toISOString() ?? null });
}
