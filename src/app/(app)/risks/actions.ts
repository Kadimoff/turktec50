"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import type { ActionState } from "@/components/documents/types";
import type { OwnerOption } from "@/components/risks/types";

const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors, ts: Date.now() });
const done = (message: string): ActionState => ({ ok: true, message, ts: Date.now() });

/** May `user` create/edit risks in this scope? Program-level (null) → ADMIN only; project → ADMIN, or TEAM/MENTOR with the project in scope. */
async function canManageRisksIn(user: CurrentUser, projectId: string | null) {
  if (user.role === "ADMIN") return projectId === null || !!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }));
  if (projectId === null || user.role === "JURY") return false;
  return !!(await prisma.project.findFirst({ where: { id: projectId, ...projectScope(user) }, select: { id: true } }));
}

/** Allowed owners: project members + mentors + active admins (program-level: admins only). */
async function ownerCandidates(projectId: string | null): Promise<OwnerOption[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  if (!projectId) return admins;
  const [members, mentors] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId, user: { active: true } }, select: { user: { select: { id: true, name: true, role: true } } }, orderBy: [{ isLead: "desc" }, { user: { name: "asc" } }] }),
    prisma.mentorAssignment.findMany({ where: { projectId, mentor: { active: true } }, select: { mentor: { select: { id: true, name: true, role: true } } } }),
  ]);
  const seen = new Set<string>();
  return [...members.map((m) => m.user), ...mentors.map((m) => m.mentor), ...admins].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
}

/** Owner options for the risk dialog (lazy-loaded when the scope changes). */
export async function loadOwnerOptions(scope: string): Promise<OwnerOption[]> {
  const user = await requireUser();
  const projectId = scope === "program" ? null : scope;
  if (!(await canManageRisksIn(user, projectId))) return [];
  return ownerCandidates(projectId);
}

function refresh(projectId: string | null) {
  revalidatePath("/risks");
  if (projectId) revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath("/", "layout");
}

const level = z.enum(["LOW", "MEDIUM", "HIGH"]);
const riskSchema = z.object({
  riskId: z.string().optional(),
  scope: z.string().min(1, "errors.projectRequired"),
  title: z.string().trim().min(3, "errors.titleShort").max(160, "errors.titleLong"),
  description: z.string().trim().max(2000).optional(),
  probability: level,
  impact: level,
  mitigation: z.string().trim().max(2000).optional(),
  ownerId: z.string().optional(),
  reviewDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.date")]).optional(),
  status: z.enum(["OPEN", "MITIGATING", "CLOSED"]).optional(),
});

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
}

export async function saveRisk(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = riskSchema.safeParse({
    riskId: str(fd, "riskId") || undefined,
    scope: str(fd, "scope") ?? "",
    title: str(fd, "title") ?? "",
    description: str(fd, "description"),
    probability: str(fd, "probability"),
    impact: str(fd, "impact"),
    mitigation: str(fd, "mitigation"),
    ownerId: str(fd, "ownerId") || undefined,
    reviewDate: str(fd, "reviewDate") ?? "",
    status: str(fd, "status") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      if (!errors[k]) errors[k] = i.message.startsWith("errors.") ? i.message : "errors.invalid";
    }
    return fail(Object.values(errors)[0] ?? "errors.invalid", errors);
  }
  const v = parsed.data;

  // existing risk keeps its scope (program vs project) — moving risks between projects is not supported
  const existing = v.riskId
    ? await prisma.risk.findUnique({ where: { id: v.riskId }, select: { id: true, projectId: true, status: true, probability: true, impact: true, ownerId: true } })
    : null;
  if (v.riskId && !existing) return fail("errors.notFound");
  const projectId = existing ? existing.projectId : v.scope === "program" ? null : v.scope;
  if (!(await canManageRisksIn(user, projectId))) return fail("errors.forbidden");

  if (v.ownerId && v.ownerId !== existing?.ownerId) {
    const allowed = await ownerCandidates(projectId);
    if (!allowed.some((o) => o.id === v.ownerId)) return fail("errors.owner", { ownerId: "errors.owner" });
  }
  const reviewDate = v.reviewDate ? new Date(`${v.reviewDate}T12:00:00+04:00`) : null;
  if (reviewDate && Number.isNaN(reviewDate.getTime())) return fail("errors.date", { reviewDate: "errors.date" });

  const data = {
    title: v.title,
    description: v.description || null,
    probability: v.probability,
    impact: v.impact,
    mitigation: v.mitigation || null,
    ownerId: v.ownerId ?? null,
    reviewDate,
  };

  if (existing) {
    const status = v.status ?? existing.status;
    await prisma.risk.update({ where: { id: existing.id }, data: { ...data, status } });
    await logAudit({
      actorId: user.id,
      action: "risk.update",
      entity: "Risk",
      entityId: existing.id,
      projectId,
      summary: v.title,
      meta: { probability: v.probability, impact: v.impact, status, from: { probability: existing.probability, impact: existing.impact, status: existing.status } },
    });
    refresh(projectId);
    return done("toast.updated");
  }

  const risk = await prisma.risk.create({
    data: { ...data, projectId, status: v.status === "MITIGATING" ? "MITIGATING" : "OPEN" },
    select: { id: true },
  });
  await logAudit({
    actorId: user.id,
    action: "risk.create",
    entity: "Risk",
    entityId: risk.id,
    projectId,
    summary: v.title,
    meta: { probability: v.probability, impact: v.impact, programLevel: projectId === null },
  });
  if (v.probability === "HIGH" || v.impact === "HIGH") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true, id: { not: user.id } }, select: { id: true } });
    await notify(admins.map((a) => a.id), "risk_high", { title: v.title }, projectId ? `/projects/${projectId}/risks` : "/risks");
  }
  refresh(projectId);
  return done("toast.created");
}

export async function setRiskStatus(riskId: string, status: "OPEN" | "CLOSED"): Promise<ActionState> {
  const user = await requireUser();
  const p = z.object({ riskId: z.string().min(1), status: z.enum(["OPEN", "CLOSED"]) }).safeParse({ riskId, status });
  if (!p.success) return fail("errors.invalid");
  const risk = await prisma.risk.findUnique({ where: { id: p.data.riskId }, select: { id: true, projectId: true, title: true, status: true } });
  if (!risk) return fail("errors.notFound");
  if (!(await canManageRisksIn(user, risk.projectId))) return fail("errors.forbidden");
  await prisma.risk.update({ where: { id: risk.id }, data: { status: p.data.status } });
  await logAudit({
    actorId: user.id,
    action: "risk.close",
    entity: "Risk",
    entityId: risk.id,
    projectId: risk.projectId,
    summary: risk.title,
    meta: { from: risk.status, to: p.data.status },
  });
  refresh(risk.projectId);
  return done(p.data.status === "CLOSED" ? "toast.closed" : "toast.reopened");
}
