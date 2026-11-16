"use server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { WIPE_PHRASE } from "@/lib/constants";
import { done, fail, type ActionState } from "@/lib/actions";
import { revalidateLayout, revalidateSets } from "@/lib/revalidate";

/**
 * Root-only destructive operations ("db silmə hüququ").
 * Every operation: server-side root check + typed confirmation + audit entry. Message keys are in the `admin.system` namespace.
 */

/** `count` = removed users (wipe only). */
export type SystemResult = ActionState & { count?: number };

const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");

async function requireRoot(): Promise<CurrentUser | null> {
  const user = await requireUser(["ADMIN"]);
  return user.isRoot ? user : null;
}

/** Remove stored files that are no longer referenced by any Document row. */
async function removeOrphanFiles(storedNames: string[]) {
  const unique = [...new Set(storedNames.map((n) => path.basename(n)).filter((n) => n && !n.startsWith(".")))];
  if (unique.length === 0) return;
  const stillUsed = new Set(
    (await prisma.document.findMany({ where: { storedName: { in: unique } }, select: { storedName: true } })).map((d) => d.storedName),
  );
  await Promise.all(
    unique.filter((n) => !stillUsed.has(n)).map((n) => fs.promises.rm(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, n), { force: true })),
  );
}

const idConfirm = z.object({ id: z.string().min(1), confirm: z.string().trim() });

export async function deleteUserPermanently(input: { id: string; confirm: string }): Promise<SystemResult> {
  const root = await requireRoot();
  if (!root) return fail("errors.rootOnly");
  const parsed = idConfirm.safeParse(input);
  if (!parsed.success) return fail("errors.error");
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, email: true, name: true, isRoot: true, role: true } });
  if (!target) return fail("errors.notFound");
  if (target.isRoot || target.id === root.id) return fail("errors.rootProtected");
  if (parsed.data.confirm.toLowerCase() !== target.email.toLowerCase()) return fail("errors.confirm");
  // documents stay with their project (uploader becomes empty); tasks/risks keep, owner is cleared
  await prisma.user.delete({ where: { id: target.id } });
  await logAudit({ actorId: root.id, action: "system.delete_user", entity: "User", entityId: target.id, summary: `${target.name} · ${target.email} · ${target.role}` });
  revalidateSets("admin", "projects", "dashboard");
  return done("user.done");
}

export async function deleteProjectPermanently(input: { id: string; confirm: string }): Promise<SystemResult> {
  const root = await requireRoot();
  if (!root) return fail("errors.rootOnly");
  const parsed = idConfirm.safeParse(input);
  if (!parsed.success) return fail("errors.error");
  const project = await prisma.project.findUnique({ where: { id: parsed.data.id }, select: { id: true, code: true, title: true } });
  if (!project) return fail("errors.notFound");
  if (parsed.data.confirm.toUpperCase() !== project.code.toUpperCase()) return fail("errors.confirm");
  const docs = await prisma.document.findMany({ where: { projectId: project.id }, select: { storedName: true } });
  // tasks, sessions, checklist, documents, risks, evaluations, assignments, project audit rows cascade
  await prisma.project.delete({ where: { id: project.id } });
  await logAudit({ actorId: root.id, action: "system.delete_project", entity: "Project", entityId: project.id, summary: `${project.code} · ${project.title}` });
  await removeOrphanFiles(docs.map((d) => d.storedName)).catch(() => {});
  revalidateLayout();
  return done("project.done");
}

export async function deleteApplicationPermanently(input: { id: string; confirm: string }): Promise<SystemResult> {
  const root = await requireRoot();
  if (!root) return fail("errors.rootOnly");
  const parsed = idConfirm.safeParse(input);
  if (!parsed.success) return fail("errors.error");
  const app = await prisma.application.findUnique({ where: { id: parsed.data.id }, select: { id: true, code: true, projectTitle: true } });
  if (!app) return fail("errors.notFound");
  if (parsed.data.confirm.toUpperCase() !== app.code.toUpperCase()) return fail("errors.confirm");
  await prisma.application.delete({ where: { id: app.id } }); // selection evaluations cascade; a linked project is kept
  await logAudit({ actorId: root.id, action: "system.delete_application", entity: "Application", entityId: app.id, summary: `${app.code} · ${app.projectTitle}` });
  revalidateLayout();
  return done("application.done");
}

/**
 * Wipe all program data. Keeps: the root account, universities, competitions (catalog + rule tracking), rubrics,
 * and the Academy reference registry (faculties, labs, partners).
 * Removes: every other user, Academy students/teams/trainings/announcements, applications, projects (and everything under them,
 * incl. resource requests), program risks, audit log, notifications, uploaded files.
 */
export async function wipeProgramData(input: { confirm: string }): Promise<SystemResult> {
  const root = await requireRoot();
  if (!root) return fail("errors.rootOnly");
  if ((input?.confirm ?? "").trim() !== WIPE_PHRASE) return fail("errors.confirm");
  try {
    const removedUsers = await prisma.$transaction(async (tx) => {
      await tx.evaluation.deleteMany({});
      await tx.intakeRequest.deleteMany({}); // public preparation requests (members + history cascade)
      await tx.team.deleteMany({}); // students.teamId / applications.teamId → SetNull
      await tx.student.deleteMany({});
      await tx.training.deleteMany({});
      await tx.announcement.deleteMany({});
      await tx.application.deleteMany({});
      await tx.project.deleteMany({}); // cascades tasks, sessions, checklist, documents, risks, members, assignments…
      await tx.risk.deleteMany({}); // program-level risks
      await tx.notification.deleteMany({});
      await tx.auditLog.deleteMany({});
      const { count } = await tx.user.deleteMany({ where: { isRoot: false } });
      return count;
    });
    // uploaded files
    await fs.promises.rm(UPLOAD_DIR, { recursive: true, force: true });
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await logAudit({ actorId: root.id, action: "system.wipe", entity: "System", entityId: root.id, summary: `${removedUsers} users removed`, meta: { removedUsers } });
    revalidateLayout();
    return done("wipe.done", { count: removedUsers });
  } catch {
    return fail("errors.error");
  }
}
