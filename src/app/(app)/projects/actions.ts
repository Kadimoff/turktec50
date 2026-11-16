"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CATEGORIES, CHECKLIST_TEMPLATE } from "@/lib/constants";
import { done, fail, failFromZod, formStr, RuleError, type ActionState } from "@/lib/actions";
import { nextProjectCode, withUniqueRetry } from "@/lib/codes";
import { assertCompetitionEligible } from "@/lib/academy/rules";
import { revalidateSets } from "@/lib/revalidate";

/** Keys are relative to the `projects.create` namespace. */
export type CreateProjectState = ActionState & { projectId?: string; code?: string };

const schema = z.object({
  title: z.string().trim().min(2, "errors.required").max(80, "errors.tooLong"),
  tagline: z.string().trim().min(5, "errors.required").max(160, "errors.tooLong"),
  summary: z.string().trim().min(10, "errors.required").max(2000, "errors.tooLong"),
  category: z.enum(CATEGORIES, { message: "errors.required" }),
  universityId: z.string().min(1, "errors.required"),
  competitionId: z.string().optional(),
});

/** Coordinator creates a project workspace manually (stage VALIDATION + submission checklist template). */
export async function createProject(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = schema.safeParse({
    title: formStr(formData, "title") ?? "",
    tagline: formStr(formData, "tagline") ?? "",
    summary: formStr(formData, "summary") ?? "",
    category: formStr(formData, "category"),
    universityId: formStr(formData, "universityId") ?? "",
    competitionId: formStr(formData, "competitionId") || undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;
  try {
    // the code is generated inside the transaction; a concurrent creation with the same code retries
    const project = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const uni = await tx.university.findUnique({ where: { id: d.universityId }, select: { id: true } });
        if (!uni) throw new RuleError("errors.required", "universityId");
        await assertCompetitionEligible(tx, d.competitionId);
        const code = await nextProjectCode(tx);
        return tx.project.create({
          data: {
            code, title: d.title, tagline: d.tagline, summary: d.summary, category: d.category, universityId: uni.id,
            competitionId: d.competitionId ?? null, stage: "VALIDATION",
            checklist: { create: CHECKLIST_TEMPLATE.map((c, i) => ({ key: c.key, category: c.category, required: c.required, order: i })) },
          },
          select: { id: true, code: true, title: true },
        });
      }),
    );
    await logAudit({ actorId: user.id, action: "project.create", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${project.title}` });
    revalidateSets("projects", "dashboard");
    return done("toast", { projectId: project.id, code: project.code });
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key, e.field ? { [e.field]: e.key } : undefined);
    return fail("errors.error");
  }
}
