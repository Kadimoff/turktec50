import type { Prisma } from "@/generated/prisma/client";

/** Action groups = prefix before the dot in audit action keys (see CONVENTIONS §3). */
export const AUDIT_GROUPS = ["auth", "application", "project", "task", "session", "document", "checklist", "risk", "evaluation", "user", "system"] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export type AuditFilters = { group?: AuditGroup; actor?: string; project?: string; from?: string; to?: string };

const one = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
};
const isDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined);

export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const g = one(sp.group);
  return {
    group: AUDIT_GROUPS.find((x) => x === g),
    actor: one(sp.actor)?.slice(0, 80),
    project: one(sp.project)?.slice(0, 40),
    from: isDate(one(sp.from)),
    to: isDate(one(sp.to)),
  };
}

/** Dates are interpreted in the programme time zone (Asia/Baku, UTC+4). */
export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (f.from) createdAt.gte = new Date(`${f.from}T00:00:00+04:00`);
  if (f.to) createdAt.lte = new Date(`${f.to}T23:59:59.999+04:00`);
  return {
    ...(f.group && { action: { startsWith: `${f.group}.` } }),
    ...(f.project && { projectId: f.project }),
    ...(f.actor && {
      actor: { OR: [{ name: { contains: f.actor, mode: "insensitive" } }, { email: { contains: f.actor, mode: "insensitive" } }] },
    }),
    ...((f.from || f.to) && { createdAt }),
  };
}

export function filtersToParams(f: AuditFilters): Record<string, string | undefined> {
  return { group: f.group, actor: f.actor, project: f.project, from: f.from, to: f.to };
}
