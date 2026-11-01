import { getLocale, getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROGRAM, currentWeek } from "@/lib/constants";
import { fmtDay, fmtDate } from "@/lib/format";
import { incubationWeeks, incubationEnd, monthLabel, programPhases, daysUntil } from "@/components/calendar/program";

/** 6-phase program timeline + 8-week incubation strip. */
export async function ProgramTimeline({ compact = false, children }: { compact?: boolean; children?: React.ReactNode }) {
  const [t, tc, locale] = await Promise.all([getTranslations("dashboard.timeline"), getTranslations("common"), getLocale()]);
  const phases = programPhases();
  const weeks = incubationWeeks();
  const cw = currentWeek();
  const incPct = Math.round((weeks.filter((w) => w.state === "done").length + (cw > 0 ? 0.5 : 0)) / PROGRAM.incubationWeeks * 100);
  const midDays = daysUntil(PROGRAM.midtermJury);

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={t("phasesLabel")}>
        {phases.map((p) => (
          <li
            key={p.key}
            aria-current={p.state === "current" ? "step" : undefined}
            className={cn(
              "relative rounded-lg border px-3 py-2.5",
              p.state === "current" && "border-primary bg-accent ring-1 ring-primary",
              p.state === "done" && "bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-[11px] font-semibold tracking-wide", p.state === "current" ? "text-accent-foreground" : "text-muted-foreground")}>
                {tc("month", { n: p.month })}
              </span>
              {p.state === "done" && (
                <span className="grid size-4 place-items-center rounded-full bg-success-soft text-success">
                  <Check className="size-3" aria-hidden />
                  <span className="sr-only">{t("done")}</span>
                </span>
              )}
              {p.state === "current" && <span className="text-[11px] font-semibold text-accent-foreground">{t("now")}</span>}
            </div>
            <p className={cn("mt-0.5 text-sm leading-snug font-semibold", p.state === "done" && "text-muted-foreground")}>{tc(`phases.${p.key}`)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{monthLabel(p.start, locale)}</p>
          </li>
        ))}
      </ol>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">
            {t("incubation", { weeks: PROGRAM.incubationWeeks })}
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {fmtDay(PROGRAM.incubationStart, locale)} – {fmtDate(incubationEnd(), locale)}
            </span>
          </p>
          <p className="text-xs font-semibold text-primary">{cw > 0 ? tc("week", { current: cw, total: PROGRAM.incubationWeeks }) : t("notStarted")}</p>
        </div>
        <ol className="mt-2 grid grid-cols-8 gap-1" aria-label={t("weeksLabel", { pct: incPct })}>
          {weeks.map((w) => (
            <li key={w.week} className="min-w-0" aria-current={w.state === "current" ? "step" : undefined}>
              <div
                className={cn(
                  "h-2 rounded-full",
                  w.state === "done" && "bg-primary",
                  w.state === "current" && "bg-primary/45 ring-2 ring-primary ring-offset-2 ring-offset-card",
                  w.state === "next" && "bg-muted",
                )}
              />
              {!compact && (
                <p className={cn("tabular mt-1.5 truncate text-center text-[11px]", w.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  <span className="sm:hidden">{w.week}</span>
                  <span className="hidden sm:inline">{t("weekShort", { n: w.week })}</span>
                  <span className="sr-only"> · {fmtDay(w.start, locale)}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        {[
          { k: "midtermJury", d: PROGRAM.midtermJury },
          { k: "mockFinal", d: PROGRAM.mockFinal },
          { k: "programEnd", d: PROGRAM.end },
        ].map(({ k, d }) => {
          const left = daysUntil(d);
          return (
            <div key={k} className={cn("rounded-lg border px-3 py-2", k === "midtermJury" && midDays >= 0 && midDays <= 30 && "border-warning/40 bg-warning-soft/60")}>
              <dt className="text-xs text-muted-foreground">{t(`milestones.${k}`)}</dt>
              <dd className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-semibold">{fmtDate(d, locale)}</span>
                <span className={cn("tabular text-xs font-semibold", left <= 30 && left >= 0 ? "text-warning" : "text-muted-foreground")}>
                  {left >= 0 ? tc("daysLeft", { count: left }) : t("passed")}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      {children}
    </div>
  );
}
