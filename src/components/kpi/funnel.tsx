import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { FunnelStep } from "./data";

/** Bullet-style funnel: one bar per step (single hue), a target tick, visible numbers and step conversion. */
export async function KpiFunnel({ steps }: { steps: FunnelStep[] }) {
  const t = await getTranslations("kpi");
  const max = Math.max(...steps.map((s) => Math.max(s.value, s.target ?? 0)), 1);
  return (
    <div>
      <ol className="space-y-3" aria-label={t("funnel.title")}>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1]!.value : null;
          const conv = prev ? Math.round((s.value / prev) * 100) : null;
          const pctTarget = s.target ? Math.round((s.value / s.target) * 100) : null;
          return (
            <li key={s.key} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_1fr_9.5rem] sm:items-center">
              <div className="flex items-baseline justify-between gap-2 sm:block">
                <p className="text-sm font-medium leading-snug">
                  <span className="tabular mr-1.5 text-xs text-muted-foreground">{i + 1}.</span>
                  {t(`funnel.steps.${s.key}`)}
                </p>
                {conv !== null && (
                  <p className="tabular text-xs text-muted-foreground">{t("funnel.conversion", { pct: conv })}</p>
                )}
              </div>
              <div className="relative h-5 rounded-md bg-muted" title={`${t(`funnel.steps.${s.key}`)}: ${s.value}${s.target ? ` / ${s.target}` : ""}`}>
                <div
                  className={cn("h-full rounded-md", s.target && s.value >= s.target ? "bg-success" : "bg-primary")}
                  style={{ width: `${Math.max(s.value > 0 ? 1.5 : 0, (s.value / max) * 100)}%` }}
                />
                {s.target && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/70"
                    style={{ left: `calc(${(s.target / max) * 100}% - 1px)` }}
                  />
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2 sm:justify-end">
                <p className="text-sm">
                  <span className="tabular text-base font-bold">{s.value}</span>
                  {s.target ? <span className="tabular text-muted-foreground"> / {s.target}</span> : null}
                </p>
                {pctTarget !== null ? (
                  <span
                    className={cn(
                      "tabular w-14 rounded-full px-2 py-0.5 text-center text-xs font-semibold",
                      pctTarget >= 100 ? "bg-success-soft text-success" : pctTarget >= 50 ? "bg-accent text-accent-foreground" : "bg-warning-soft text-warning",
                    )}
                  >
                    {pctTarget}%
                  </span>
                ) : (
                  <span className="w-14 text-center text-xs text-muted-foreground">—</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-2.5 rounded-sm bg-primary" />{t("funnel.legendActual")}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground/70" />{t("funnel.legendTarget")}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-2.5 rounded-sm bg-success" />{t("funnel.legendMet")}</span>
      </p>
    </div>
  );
}
