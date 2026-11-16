import type { Prisma } from "@/generated/prisma/client";
import { bakuAddDays, bakuParts, bakuStartOfDay, parseBakuDate } from "@/lib/dates";
import { pick, str, type SearchParams } from "@/lib/search-params";

/** Action groups = prefix before the dot in audit action keys (see CONVENTIONS §3). */
export const AUDIT_GROUPS = [
  "auth", "application", "project", "task", "session", "document", "checklist", "risk", "evaluation",
  "intake", "competition", "registry", "student", "team", "training", "resource", "announcement", "user", "system",
] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

/** Relative periods; a calendar month is given as "yyyy-mm". All in programme time (Asia/Baku). */
export const AUDIT_PERIODS = ["today", "7d", "30d"] as const;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type AuditFilters = { group?: AuditGroup; actor?: string; project?: string; period?: string; from?: string; to?: string };

const ymd = (v: string | undefined) => (v && parseBakuDate(v) ? v : undefined);

export function parseAuditFilters(sp: SearchParams): AuditFilters {
  const period = str(sp.period, 7);
  return {
    group: pick(sp.group, AUDIT_GROUPS),
    actor: str(sp.actor, 80),
    project: str(sp.project, 40),
    period: period && ((AUDIT_PERIODS as readonly string[]).includes(period) || MONTH_RE.test(period)) ? period : undefined,
    from: ymd(str(sp.from, 10)),
    to: ymd(str(sp.to, 10)),
  };
}

/** [from, to) of a period, in Baku calendar days / months. */
export function periodRange(period: string, now = new Date()): { gte: Date; lt?: Date } | null {
  const today = bakuStartOfDay(now);
  if (period === "today") return { gte: today };
  if (period === "7d") return { gte: bakuAddDays(today, -6) };
  if (period === "30d") return { gte: bakuAddDays(today, -29) };
  const m = MONTH_RE.exec(period);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  const gte = parseBakuDate(`${y}-${String(mo).padStart(2, "0")}-01`, "00:00");
  const lt = parseBakuDate(mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`, "00:00");
  return gte && lt ? { gte, lt } : null;
}

/** "yyyy-mm" of every Baku month from `first` to `now`, newest first (at most `max`). */
export function monthsSince(first: Date, now = new Date(), max = 12) {
  const a = bakuParts(first), b = bakuParts(now);
  const out: string[] = [];
  let y = b.y;
  let m = b.m;
  while ((y > a.y || (y === a.y && m >= a.m)) && out.length < max) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (m === 1) {
      y--;
      m = 12;
    } else m--;
  }
  return out;
}

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  // a custom from/to range (inclusive Baku calendar days) wins over the quick period
  const custom = f.from || f.to
    ? {
        ...(f.from && { gte: parseBakuDate(f.from, "00:00")! }),
        ...(f.to && { lt: bakuAddDays(parseBakuDate(f.to, "00:00")!, 1) }),
      }
    : null;
  const range = custom ?? (f.period ? periodRange(f.period) : null);
  return {
    ...(f.group && { action: { startsWith: `${f.group}.` } }),
    ...(f.project && { projectId: f.project }),
    ...(f.actor && {
      actor: { OR: [{ name: { contains: f.actor, mode: "insensitive" } }, { email: { contains: f.actor, mode: "insensitive" } }] },
    }),
    ...(range && { createdAt: range }),
  };
}

export function filtersToParams(f: AuditFilters): Record<string, string | undefined> {
  return { group: f.group, actor: f.actor, project: f.project, period: f.period, from: f.from, to: f.to };
}
