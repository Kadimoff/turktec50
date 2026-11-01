"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CATEGORIES, CHECKLIST_TEMPLATE } from "@/lib/constants";
import { nextProjectCode } from "@/components/projects/server";

export type CreateProjectState =
  | { ok: true; projectId: string; code: string; at: number }
  | { ok: false; error: "invalid" | "error"; fieldErrors?: Partial<Record<"title" | "tagline" | "summary" | "category" | "universityId" | "competitionId", string>>; at: number }
  | undefined;

const schema = z.object({
  title: z.string().trim().min(2, "required").max(80, "tooLong"),
  tagline: z.string().trim().min(5, "required").max(160, "tooLong"),
  summary: z.string().trim().min(10, "required").max(2000, "tooLong"),
  category: z.enum(CATEGORIES, { message: "required" }),
  universityId: z.string().min(1, "required"),
  competitionId: z.string().optional(),
});

/** Coordinator creates a project workspace manually (stage VALIDATION + submission checklist template). */
export async function createProject(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const user = await requireUser(["ADMIN"]);
  const at = Date.now();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message === "tooLong" ? "tooLong" : "required";
    }
    return { ok: false, error: "invalid", fieldErrors, at };
  }
  const d = parsed.data;
  const [uni, comp] = await Promise.all([
    prisma.university.findUnique({ where: { id: d.universityId }, select: { id: true } }),
    d.competitionId ? prisma.competition.findUnique({ where: { id: d.competitionId }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!uni) return { ok: false, error: "invalid", fieldErrors: { universityId: "required" }, at };
  try {
    const project = await prisma.$transaction(async (tx) => {
      const code = await nextProjectCode(tx);
      return tx.project.create({
        data: {
          code, title: d.title, tagline: d.tagline, summary: d.summary, category: d.category, universityId: uni.id,
          competitionId: comp?.id ?? null, stage: "VALIDATION",
          checklist: { create: CHECKLIST_TEMPLATE.map((c, i) => ({ key: c.key, category: c.category, required: c.required, order: i })) },
        },
        select: { id: true, code: true, title: true },
      });
    });
    await logAudit({ actorId: user.id, action: "project.create", entity: "Project", entityId: project.id, projectId: project.id, summary: `${project.code} · ${project.title}` });
    revalidatePath("/projects");
    return { ok: true, projectId: project.id, code: project.code, at };
  } catch {
    return { ok: false, error: "error", at };
  }
}
