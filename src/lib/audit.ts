import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Every audit action key. Each is translated under messages audit.actions.<group>.<verb> (az/tr/en) and the group
 * (prefix before the dot) is listed in AUDIT_GROUPS (src/components/audit/query.ts). Add new keys here first.
 */
export const AUDIT_ACTIONS = [
  "auth.login", "auth.logout",
  "application.create", "application.evaluate", "application.decide",
  "project.create", "project.update", "project.stage", "project.flags", "project.academy",
  "project.assign_mentor", "project.unassign_mentor", "project.assign_jury", "project.unassign_jury",
  "task.create", "task.update", "task.status", "task.delete",
  "session.create", "session.update", "session.complete", "session.cancel", "session.convert_step",
  "document.upload", "document.delete", "checklist.review", "checklist.add",
  "risk.create", "risk.update", "risk.close", "risk.reopen",
  "evaluation.save", "evaluation.submit",
  "user.create", "user.update", "user.activate", "user.deactivate", "user.password_reset", "user.password_change",
  "system.delete_user", "system.delete_project", "system.delete_application", "system.wipe",
  "competition.track", "competition.untrack",
  "registry.create", "registry.update", "registry.delete",
  "student.create", "student.update", "student.delete",
  "team.create", "team.update", "team.members", "team.delete",
  "training.create", "training.update", "training.delete",
  "resource.create", "resource.update", "resource.decide",
  "announcement.create", "announcement.update", "announcement.publish", "announcement.delete",
  "intake.submit", "intake.update", "intake.withdraw", "intake.review", "intake.accept", "intake.reject",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** In-app notification types; each is translated under messages common.notifications.<type> with its params. */
export const NOTIFICATION_TYPES = [
  "task_assigned", "task_done", "session_planned", "session_notes", "document_reviewed", "document_uploaded", "risk_high",
  "stage_changed", "evaluation_submitted", "assigned_project", "application_decided",
  "announcement", "resource_requested", "resource_decided", "team_mentor", "intake_submitted", "intake_resubmitted",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Record a change. Every mutating server action MUST call this ("işlem ve değişiklik kaydı").
 * `summary` stays language-neutral (names, codes, raw enum values) — it is shown to readers of every language.
 */
export async function logAudit(input: {
  actorId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  projectId?: string | null;
  summary?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      summary: input.summary ?? null,
      meta: input.meta,
    },
  });
}

/** In-app notification (no e-mail in MVP). `type` translated under common.notifications.<type>. */
export async function notify(userIds: string[], type: NotificationType, params: Record<string, string> = {}, href?: string) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: [...new Set(userIds)].map((userId) => ({ userId, type, params, href })),
  });
}
