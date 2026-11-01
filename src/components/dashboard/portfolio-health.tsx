import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleCheck, Eye, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_ORDER } from "@/lib/constants";
import { toneClasses } from "@/lib/tones";

// Ordinal ramp for stages (one hue, light → dark). Literal classes so Tailwind can see them.
const STAGE_SHADE = ["bg-primary/25", "bg-primary/45", "bg-primary/65", "bg-primary/85", "bg-primary"] as const;

export async function PortfolioHealth({
  stages,
  health,
}: {
  stages: Record<string, number>;
  health: Record<"ON_TRACK" | "WATCH" | "AT_RISK", number>;
}) {
  const [t, te] = await Promise.all([getTranslations("dashboard.health"), getTranslations("enums")]);
  const total = STAGE_ORDER.reduce((a, s) => a + (stages[s] ?? 0), 0) || 1;
  const healthItems = [
    { k: "ON_TRACK", icon: CircleCheck, tone: "success" },
    { k: "WATCH", icon: Eye, tone: "warning" },
    { k: "AT_RISK", icon: TriangleAlert, tone: "danger" },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{t("stageDistribution")}</h3>
        <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {STAGE_ORDER.map((s, i) =>
            stages[s] ? (
              <div
                key={s}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", STAGE_SHADE[i])}
                style={{ width: `${((stages[s] ?? 0) / total) * 100}%` }}
                title={`${te(`ProjectStage.${s}`)}: ${stages[s]}`}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 space-y-0.5">
          {STAGE_ORDER.map((s, i) => {
            const n = stages[s] ?? 0;
            return (
              <li key={s}>
                <Link
                  href={`/projects?stage=${s}`}
                  className="-mx-2 flex min-h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", STAGE_SHADE[i])} />
                  <span className="flex-1 truncate">{te(`ProjectStage.${s}`)}</span>
                  <span className="tabular font-semibold">{n}</span>
                  <span className="tabular w-10 text-right text-xs text-muted-foreground">{Math.round((n / total) * 100)}%</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{t("healthCounts")}</h3>
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {healthItems.map(({ k, icon: Icon, tone }) => (
            <li key={k}>
              <Link
                href={`/projects?health=${k}`}
                className="flex h-full flex-col rounded-lg border px-2.5 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={cn("inline-flex size-6 items-center justify-center rounded-md", toneClasses[tone])} aria-hidden>
                  <Icon className="size-3.5" />
                </span>
                <span className="tabular mt-1.5 text-xl leading-none font-bold">{health[k]}</span>
                <span className="mt-1 text-[11px] leading-tight text-muted-foreground">{te(`ProjectHealth.${k}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
