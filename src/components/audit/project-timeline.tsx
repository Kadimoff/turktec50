import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ActionIcon, actionLabel } from "./labels";

const TZ_OFFSET_MS = 4 * 3600 * 1000; // programme time zone Asia/Baku (UTC+4, no DST)
const dayKey = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);

type Item =
  | { kind: "audit"; id: string; at: Date; actor: { name: string; role: string } | null; action: string; summary: string | null }
  | { kind: "stage"; id: string; at: Date; actor: { name: string; role: string } | null; from: string; to: string; note: string | null };

/** Project activity feed: AuditLog rows of the project + StageChange rows, newest first, grouped by day (Asia/Baku). */
export async function ProjectTimeline({ projectId, limit, moreHref }: { projectId: string; limit: number; moreHref: string }) {
  const [t, tc, te, locale] = await Promise.all([getTranslations("audit"), getTranslations("common"), getTranslations("enums"), getLocale()]);
  const [logs, stages, totalLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, action: true, summary: true, createdAt: true, actor: { select: { name: true, role: true } } },
    }),
    prisma.stageChange.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.auditLog.count({ where: { projectId } }),
  ]);
  const actorIds = [...new Set(stages.map((s) => s.actorId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  const items: Item[] = [
    ...logs.map((l) => ({ kind: "audit" as const, id: l.id, at: l.createdAt, actor: l.actor, action: l.action, summary: l.summary })),
    ...stages.map((s) => ({
      kind: "stage" as const, id: s.id, at: s.createdAt, actor: s.actorId ? actorById.get(s.actorId) ?? null : null,
      from: s.fromStage, to: s.toStage, note: s.note,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);

  if (items.length === 0) return <EmptyState icon={History} title={t("activity.empty")} description={t("activity.emptyHint")} />;

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const k = dayKey(it.at);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  const time = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku" });
  const dayLabel = (k: string) =>
    k === today ? tc("today") : k === yesterday ? t("activity.yesterday") : fmtDate(new Date(`${k}T12:00:00+04:00`), locale);

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([k, list]) => (
        <section key={k} aria-labelledby={`day-${k}`}>
          <h3 id={`day-${k}`} className="sticky top-14 z-10 -mx-1 flex items-baseline gap-2 bg-background/90 px-1 py-1.5 text-sm font-semibold backdrop-blur-sm">
            {dayLabel(k)}
            <span className="text-xs font-normal text-muted-foreground">{t("activity.events", { count: list.length })}</span>
          </h3>
          <ol className="relative mt-2 space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
            {list.map((it) => (
              <li key={it.id} className="relative flex gap-3 rounded-lg py-2 pr-2">
                <ActionIcon action={it.kind === "stage" ? "stage" : it.action} className="relative ring-4 ring-background" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{it.actor?.name ?? t("system")}</span>{" "}
                    <span className="text-muted-foreground">{it.kind === "stage" ? t("activity.stageChange") : actionLabel(t, it.action)}</span>
                  </p>
                  {it.kind === "stage" ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <EnumBadge enumName="ProjectStage" value={it.from} />
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="→" />
                      <EnumBadge enumName="ProjectStage" value={it.to} />
                      {it.note && <p className="w-full pt-1 text-sm text-muted-foreground">{it.note}</p>}
                    </div>
                  ) : (
                    it.summary && <p className="truncate text-sm text-muted-foreground">{it.summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time dateTime={it.at.toISOString()} className="tabular text-xs text-muted-foreground">{time.format(it.at)}</time>
                  {it.actor && <span className="hidden text-[11px] text-muted-foreground sm:inline">{te(`Role.${it.actor.role}` as never)}</span>}
                </div>
                {it.actor && <UserAvatar name={it.actor.name} size="sm" className="hidden md:inline-grid" />}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {totalLogs > limit && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs text-muted-foreground">{t("activity.showing", { count: limit })}</p>
          <Link href={moreHref} scroll={false} className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30">
            {t("activity.more")}
          </Link>
        </div>
      )}
    </div>
  );
}
