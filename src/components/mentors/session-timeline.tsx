import { getLocale, getTranslations } from "next-intl/server";
import { differenceInCalendarDays } from "date-fns";
import { CalendarCheck2, CalendarClock, CalendarX2, History } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/tone-badge";
import { fmtDate, fmtRelative } from "@/lib/format";
import { SessionCard } from "./session-card";
import { CADENCE_DAYS } from "./queries";
import type { SessionItem } from "./types";

/** Upcoming first (soonest first), then past (most recent first) with notes, next steps and convert buttons. */
export async function SessionTimeline({
  upcoming,
  past,
  showProject = false,
  showMentor = true,
}: {
  upcoming: SessionItem[];
  past: SessionItem[];
  showProject?: boolean;
  showMentor?: boolean;
}) {
  const t = await getTranslations("mentors.timeline");
  return (
    <div className="space-y-6">
      <section aria-labelledby="tl-upcoming" className="space-y-3">
        <h3 id="tl-upcoming" className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          {t("upcoming")}
          <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{upcoming.length}</span>
        </h3>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("emptyUpcoming")} description={t("emptyUpcomingHint")} className="py-8" />
        ) : (
          <div className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} showProject={showProject} showMentor={showMentor} />
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="tl-past" className="space-y-3">
        <h3 id="tl-past" className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-primary" aria-hidden />
          {t("past")}
          <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{past.length}</span>
        </h3>
        {past.length === 0 ? (
          <EmptyState icon={History} title={t("emptyPast")} className="py-8" />
        ) : (
          <ol className="relative space-y-3 border-l border-dashed pl-4 sm:pl-5">
            {past.map((s) => (
              <li key={s.id} className="relative">
                <span aria-hidden className="absolute top-5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary sm:-left-[25px]" />
                <SessionCard session={s} showProject={showProject} showMentor={showMentor} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Cadence: last completed / next planned session vs. the "at least every two weeks" rule. */
export async function CadenceStrip({ last, next, className }: { last: Date | null; next: Date | null; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("mentors.timeline"), getLocale()]);
  const now = new Date();
  const since = last ? differenceInCalendarDays(now, last) : null;
  const ok = since !== null && since <= CADENCE_DAYS;
  return (
    <div className={`grid gap-3 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-3 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
          <CalendarCheck2 className="size-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t("last")}</p>
          <p className="text-sm font-semibold">{last ? fmtRelative(last, locale) : t("never")}</p>
          {last && <p className="tabular text-xs text-muted-foreground">{fmtDate(last, locale)}</p>}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-info-soft text-info" aria-hidden>
          <CalendarClock className="size-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t("next")}</p>
          <p className="text-sm font-semibold">{next ? fmtRelative(next, locale) : t("notPlanned")}</p>
          {next && <p className="tabular text-xs text-muted-foreground">{fmtDate(next, locale)}</p>}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`} aria-hidden>
          {ok ? <CalendarCheck2 className="size-4" /> : <CalendarX2 className="size-4" />}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t("rule")}</p>
          <ToneBadge tone={ok ? "success" : "danger"} className="mt-0.5">
            {ok ? t("cadenceOk") : t("cadenceLate")}
          </ToneBadge>
        </div>
      </div>
    </div>
  );
}
