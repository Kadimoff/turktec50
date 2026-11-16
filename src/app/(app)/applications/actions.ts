"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { weightedScore } from "@/lib/kpi";
import { CHECKLIST_TEMPLATE } from "@/lib/constants";
import { done, fail, failFromZod, formStr, isUniqueViolation, RuleError, type ActionState } from "@/lib/actions";
import { nextProjectCode, withUniqueRetry } from "@/lib/codes";
import { generateTempPassword, hashPassword } from "@/lib/passwords";
import { revalidateSets } from "@/lib/revalidate";
import { syncApplicationWorkflow, syncProjectWorkflow } from "@/lib/workflow";

function revalidateApplication(id: string) {
  revalidateSets("applications", "dashboard");
  revalidatePath(`/applications/${id}`);
}

/** Rubric save result (keys in `applications.rubric`); `missing` = criterion ids still unscored on submit. */
export type EvalState = ActionState & { intent?: "draft" | "submit"; missing?: string[] };

const evalSchema = z.object({
  applicationId: z.string().min(1, "errors.invalid"),
  intent: z.enum(["draft", "submit"], "errors.invalid"),
  comment: z.string().trim().max(2000, "errors.invalid").optional().default(""),
});

/** Save (draft) or submit a selection-rubric evaluation by the current juror/coordinator. Advisory only. */
export async function saveSelectionEvaluation(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const user = await requireUser(["ADMIN", "JURY"]);
  const parsed = evalSchema.safeParse({
    applicationId: formStr(formData, "applicationId"),
    intent: formStr(formData, "intent"),
    comment: formStr(formData, "comment") ?? "",
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { applicationId, intent, comment } = parsed.data;

  const [app, rubric] = await Promise.all([
    prisma.application.findUnique({ where: { id: applicationId }, select: { id: true, code: true, projectTitle: true, status: true } }),
    prisma.rubric.findUnique({ where: { kind: "SELECTION" }, select: { id: true, criteria: { orderBy: { order: "asc" } } } }),
  ]);
  if (!app || !rubric) return fail("errors.notFound");

  const scores: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const raw = formStr(formData, `score_${c.id}`);
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > c.maxScore) return fail("errors.invalid");
    scores[c.id] = n;
  }
  if (intent === "submit") {
    const missing = rubric.criteria.filter((c) => scores[c.id] === undefined).map((c) => c.id);
    if (missing.length) return { ...fail("errors.incomplete"), missing };
  }

  const status = intent === "submit" ? "SUBMITTED" : "DRAFT";
  const data = { comment: comment || null, status, submittedAt: status === "SUBMITTED" ? new Date() : null } as const;
  let evaluationId: string;
  try {
    evaluationId = await prisma.$transaction(async (tx) => {
      // the lock is checked by the write itself: a submitted evaluation is never changed, even by a parallel request
      const existing = await tx.evaluation.findFirst({ where: { rubricId: rubric.id, evaluatorId: user.id, applicationId }, select: { id: true } });
      let id: string;
      if (existing) {
        const { count } = await tx.evaluation.updateMany({ where: { id: existing.id, status: "DRAFT" }, data });
        if (count !== 1) throw new RuleError("errors.locked");
        id = existing.id;
      } else {
        id = (await tx.evaluation.create({ data: { rubricId: rubric.id, evaluatorId: user.id, applicationId, ...data }, select: { id: true } })).id;
      }
      await tx.evaluationScore.deleteMany({ where: { evaluationId: id } });
      const entries = Object.entries(scores);
      if (entries.length) {
        await tx.evaluationScore.createMany({ data: entries.map(([criterionId, score]) => ({ evaluationId: id, criterionId, score })) });
      }
      if (status === "SUBMITTED") {
        await tx.application.updateMany({ where: { id: app.id, status: "SUBMITTED" }, data: { status: "UNDER_REVIEW" } });
      }
      return id;
    });
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key);
    if (isUniqueViolation(e)) return fail("errors.error"); // a parallel first save of the same evaluator
    throw e;
  }

  if (status === "SUBMITTED" && app.status === "SUBMITTED") await syncApplicationWorkflow(app.id, user.id);
  const score = weightedScore(rubric.criteria, scores);
  await logAudit({
    actorId: user.id,
    action: "application.evaluate",
    entity: "Application",
    entityId: app.id,
    summary: `${app.code} · ${app.projectTitle} · ${status}`,
    meta: { evaluationId, status, score },
  });
  if (status === "SUBMITTED") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true, id: { not: user.id } }, select: { id: true } });
    await notify(admins.map((a) => a.id), "evaluation_submitted", { project: `${app.code} · ${app.projectTitle}` }, `/applications/${app.id}`);
  }

  revalidateApplication(app.id);
  return done(intent === "submit" ? "toastSubmitted" : "toastDraft", { intent });
}

const decisionSchema = z.object({
  applicationId: z.string().min(1, "errors.notFound"),
  status: z.enum(["ACCEPTED", "WAITLIST", "REJECTED"], "errors.invalid"),
  note: z.string().trim().min(10, "errors.noteRequired").max(1000, "errors.noteRequired"),
});

/** Coordinator records a HUMAN decision with a rationale. The system never decides on its own. Keys in `applications.decision`. */
export async function decideApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = decisionSchema.safeParse({
    applicationId: formStr(formData, "applicationId"),
    status: formStr(formData, "status"),
    note: formStr(formData, "note") ?? "",
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { applicationId, status, note } = parsed.data;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, code: true, teamName: true, status: true, projectId: true, evaluations: { select: { evaluatorId: true } } },
  });
  if (!app) return fail("errors.notFound");
  if (app.projectId) return fail("errors.locked");

  // conditional on "no workspace yet": a decision never changes after a project was created from it
  const { count } = await prisma.application.updateMany({
    where: { id: app.id, projectId: null },
    data: { status, decisionNote: note, decidedAt: new Date() },
  });
  if (count !== 1) return fail("errors.locked");
  await logAudit({
    actorId: user.id,
    action: "application.decide",
    entity: "Application",
    entityId: app.id,
    summary: `${app.code} · ${app.teamName}: ${app.status} → ${status}`,
    meta: { from: app.status, to: status, note },
  });
  await syncApplicationWorkflow(app.id, user.id, note);
  await notify(
    app.evaluations.map((e) => e.evaluatorId).filter((id) => id !== user.id),
    "application_decided",
    { team: app.teamName },
    `/applications/${app.id}`,
  );
  revalidateApplication(app.id);
  return done("toast");
}

/**
 * Workspace result (keys in `applications.workspace`). For a NEW lead account `tempPassword` is the generated password, returned once
 * (only its hash is stored; the lead must change it at the first sign-in).
 */
export type WorkspaceResult = ActionState & { projectId?: string; code?: string; email?: string; tempPassword?: string };

/** Create the project workspace (VALIDATION stage + 13 checklist items + lead TEAM account) for an accepted application. */
export async function createWorkspaceFromApplication(applicationId: string): Promise<WorkspaceResult> {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).safeParse(applicationId);
  if (!id.success) return fail("errors.notFound");
  const app = await prisma.application.findUnique({
    where: { id: id.data },
    include: { university: { select: { country: true } }, team: { select: { id: true, facultyId: true, captainId: true } } },
  });
  if (!app) return fail("errors.notFound");
  if (app.status !== "ACCEPTED") return fail("errors.notAccepted");
  if (app.projectId) return fail("errors.exists");

  const email = app.contactEmail.toLowerCase().trim();
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const locale = app.university.country === "AZ" ? "az" : app.university.country === "TR" ? "tr" : "en";

  let result: { project: { id: string; code: string; title: string }; lead: { id: string; name: string; isNew: boolean } };
  try {
    result = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
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
            facultyId: app.team?.facultyId ?? null, // Academy team → project keeps its faculty
            stage: "VALIDATION",
            checklist: {
              create: CHECKLIST_TEMPLATE.map((c, i) => ({ key: c.key, category: c.category, required: c.required, order: i })),
            },
          },
          select: { id: true, code: true, title: true },
        });
        // claim the application (still accepted, still without a project) — a parallel click loses here
        const claim = await tx.application.updateMany({ where: { id: app.id, status: "ACCEPTED", projectId: null }, data: { projectId: project.id } });
        if (claim.count !== 1) throw new RuleError("errors.exists");

        const found = await tx.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
        const lead = found
          ? { ...found, isNew: false }
          : {
              ...(await tx.user.create({
                data: { email, name: app.contactName, passwordHash, mustChangePassword: true, role: "TEAM", universityId: app.universityId, locale },
                select: { id: true, name: true, role: true },
              })),
              isNew: true,
            };
        if (lead.role === "TEAM") {
          await tx.projectMember.create({ data: { projectId: project.id, userId: lead.id, teamRole: "Team lead", isLead: true } });
          // Academy: link the team captain's student record to the lead account (only if not linked to someone else)
          if (app.team?.captainId) {
            await tx.student.updateMany({ where: { id: app.team.captainId, userId: null }, data: { userId: lead.id } });
          }
        }
        return { project, lead: { id: lead.id, name: lead.name, isNew: lead.isNew } };
      }),
    );
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key);
    return fail("errors.error");
  }

  if (result.lead.isNew) {
    await logAudit({
      actorId: user.id, action: "user.create", entity: "User", entityId: result.lead.id, summary: `${result.lead.name} · TEAM`,
      meta: { source: "application", application: app.code, temporaryPassword: true },
    });
  }
  await logAudit({
    actorId: user.id,
    action: "project.create",
    entity: "Project",
    entityId: result.project.id,
    projectId: result.project.id,
    summary: `${result.project.code} · ${result.project.title} (${app.code})`,
    meta: { applicationId: app.id, leadEmail: email, newUser: result.lead.isNew },
  });
  // process map: application → "workspace created", new project → its first stage (+ history)
  await syncApplicationWorkflow(app.id, user.id);
  await syncProjectWorkflow(result.project.id, user.id);
  revalidateApplication(app.id);
  revalidateSets("projects", "admin");
  return done("toast", {
    projectId: result.project.id,
    code: result.project.code,
    email,
    ...(result.lead.isNew ? { tempPassword } : {}),
  });
}
