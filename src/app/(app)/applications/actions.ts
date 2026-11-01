"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { weightedScore } from "@/lib/kpi";
import { CHECKLIST_TEMPLATE } from "@/lib/constants";
import { nextProjectCode } from "@/components/projects/server";

export type EvalState =
  | { ok: true; intent: "draft" | "submit"; at: number }
  | { ok: false; error: "invalid" | "incomplete" | "locked" | "notFound" | "error"; missing?: string[]; at: number }
  | undefined;

const evalSchema = z.object({
  applicationId: z.string().min(1),
  intent: z.enum(["draft", "submit"]),
  comment: z.string().trim().max(2000).optional().default(""),
});

/** Save (draft) or submit a selection-rubric evaluation by the current juror/coordinator. Advisory only. */
export async function saveSelectionEvaluation(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const user = await requireUser(["ADMIN", "JURY"]);
  const at = Date.now();
  const parsed = evalSchema.safeParse({
    applicationId: formData.get("applicationId"),
    intent: formData.get("intent"),
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid", at };
  const { applicationId, intent, comment } = parsed.data;

  const [app, rubric] = await Promise.all([
    prisma.application.findUnique({ where: { id: applicationId }, select: { id: true, code: true, projectTitle: true, status: true } }),
    prisma.rubric.findUnique({ where: { kind: "SELECTION" }, select: { id: true, criteria: { orderBy: { order: "asc" } } } }),
  ]);
  if (!app || !rubric) return { ok: false, error: "notFound", at };

  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const raw = formData.get(`score_${c.id}`);
    if (raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > c.maxScore) return { ok: false, error: "invalid", at };
    scores[c.id] = n;
  }
  if (intent === "submit") {
    const missing = rubric.criteria.filter((c) => scores[c.id] === undefined).map((c) => c.id);
    if (missing.length) return { ok: false, error: "incomplete", missing, at };
  }

  const existing = await prisma.evaluation.findFirst({
    where: { rubricId: rubric.id, evaluatorId: user.id, applicationId },
    select: { id: true, status: true },
  });
  if (existing?.status === "SUBMITTED") return { ok: false, error: "locked", at };

  const status = intent === "submit" ? "SUBMITTED" : "DRAFT";
  const evaluation = await prisma.$transaction(async (tx) => {
    const ev = existing
      ? await tx.evaluation.update({
          where: { id: existing.id },
          data: { comment: comment || null, status, submittedAt: status === "SUBMITTED" ? new Date() : null },
        })
      : await tx.evaluation.create({
          data: {
            rubricId: rubric.id, evaluatorId: user.id, applicationId, comment: comment || null, status,
            submittedAt: status === "SUBMITTED" ? new Date() : null,
          },
        });
    await tx.evaluationScore.deleteMany({ where: { evaluationId: ev.id } });
    const entries = Object.entries(scores);
    if (entries.length) {
      await tx.evaluationScore.createMany({ data: entries.map(([criterionId, score]) => ({ evaluationId: ev.id, criterionId, score })) });
    }
    if (status === "SUBMITTED" && app.status === "SUBMITTED") {
      await tx.application.update({ where: { id: app.id }, data: { status: "UNDER_REVIEW" } });
    }
    return ev;
  });

  const score = weightedScore(rubric.criteria, scores);
  await logAudit({
    actorId: user.id,
    action: "application.evaluate",
    entity: "Application",
    entityId: app.id,
    summary: `${app.code} · ${app.projectTitle} · ${status}`,
    meta: { evaluationId: evaluation.id, status, score },
  });
  if (status === "SUBMITTED") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true, id: { not: user.id } }, select: { id: true } });
    await notify(admins.map((a) => a.id), "evaluation_submitted", { project: `${app.code} · ${app.projectTitle}` }, `/applications/${app.id}`);
  }

  revalidatePath(`/applications/${app.id}`);
  revalidatePath("/applications");
  return { ok: true, intent, at };
}

export type DecisionState =
  | { ok: true; at: number }
  | { ok: false; error: "invalid" | "noteRequired" | "locked" | "notFound"; at: number }
  | undefined;

const decisionSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(["ACCEPTED", "WAITLIST", "REJECTED"]),
  note: z.string().trim(),
});

/** Coordinator records a HUMAN decision with a rationale. The system never decides on its own. */
export async function decideApplication(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const user = await requireUser(["ADMIN"]);
  const at = Date.now();
  const parsed = decisionSchema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid", at };
  const { applicationId, status, note } = parsed.data;
  if (note.length < 10 || note.length > 1000) return { ok: false, error: "noteRequired", at };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, code: true, teamName: true, status: true, projectId: true, evaluations: { select: { evaluatorId: true } } },
  });
  if (!app) return { ok: false, error: "notFound", at };
  if (app.projectId) return { ok: false, error: "locked", at };

  await prisma.application.update({ where: { id: app.id }, data: { status, decisionNote: note, decidedAt: new Date() } });
  await logAudit({
    actorId: user.id,
    action: "application.decide",
    entity: "Application",
    entityId: app.id,
    summary: `${app.code} · ${app.teamName}: ${app.status} → ${status}`,
    meta: { from: app.status, to: status, note },
  });
  await notify(
    app.evaluations.map((e) => e.evaluatorId).filter((id) => id !== user.id),
    "application_decided",
    { team: app.teamName },
    `/applications/${app.id}`,
  );
  revalidatePath(`/applications/${app.id}`);
  revalidatePath("/applications");
  return { ok: true, at };
}

export type WorkspaceResult = { ok: true; projectId: string; code: string; newUser: boolean } | { ok: false; error: "notAccepted" | "exists" | "notFound" | "error" };

const DEMO_PASSWORD = "Demo2026!";

/** Create the project workspace (VALIDATION stage + 13 checklist items + lead TEAM account) for an accepted application. */
export async function createWorkspaceFromApplication(applicationId: string): Promise<WorkspaceResult> {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).safeParse(applicationId);
  if (!id.success) return { ok: false, error: "notFound" };
  const app = await prisma.application.findUnique({
    where: { id: id.data },
    include: { university: { select: { country: true } } },
  });
  if (!app) return { ok: false, error: "notFound" };
  if (app.status !== "ACCEPTED") return { ok: false, error: "notAccepted" };
  if (app.projectId) return { ok: false, error: "exists" };

  const email = app.contactEmail.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const locale = app.university.country === "AZ" ? "az" : app.university.country === "TR" ? "tr" : "en";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const code = await nextProjectCode(tx);
      const project = await tx.project.create({
        data: {
          code,
          title: app.projectTitle,
          tagline: app.solution.slice(0, 160),
          summary: app.problem,
          category: app.category,
          universityId: app.universityId,
          competitionId: app.competitionId,
          stage: "VALIDATION",
          checklist: {
            create: CHECKLIST_TEMPLATE.map((c, i) => ({ key: c.key, category: c.category, required: c.required, order: i })),
          },
        },
      });
      let lead = await tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
      let newUser = false;
      if (!lead) {
        lead = await tx.user.create({
          data: { email, name: app.contactName, passwordHash, role: "TEAM", universityId: app.universityId, locale },
          select: { id: true, role: true },
        });
        newUser = true;
      }
      if (lead.role === "TEAM") {
        await tx.projectMember.create({ data: { projectId: project.id, userId: lead.id, teamRole: "Team lead", isLead: true } });
      }
      await tx.application.update({ where: { id: app.id }, data: { projectId: project.id } });
      return { project, newUser };
    });

    await logAudit({
      actorId: user.id,
      action: "project.create",
      entity: "Project",
      entityId: result.project.id,
      projectId: result.project.id,
      summary: `${result.project.code} · ${result.project.title} (${app.code})`,
      meta: { applicationId: app.id, leadEmail: email, newUser: result.newUser },
    });
    revalidatePath(`/applications/${app.id}`);
    revalidatePath("/applications");
    revalidatePath("/projects");
    return { ok: true, projectId: result.project.id, code: result.project.code, newUser: result.newUser };
  } catch {
    return { ok: false, error: "error" };
  }
}
