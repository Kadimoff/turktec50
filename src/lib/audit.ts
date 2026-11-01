import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Record a change. Every mutating server action MUST call this ("işlem ve değişiklik kaydı").
 * `action` is a dotted key translated under messages audit.actions.<action>, e.g. "task.create".
 */
export async function logAudit(input: {
  actorId: string | null;
  action: string;
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
export async function notify(userIds: string[], type: string, params: Record<string, string> = {}, href?: string) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: [...new Set(userIds)].map((userId) => ({ userId, type, params, href })),
  });
}
