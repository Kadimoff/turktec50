import { cn } from "@/lib/utils";
import { toneClasses, toneBar, type Tone } from "@/lib/tones";
import type { LucideIcon } from "lucide-react";

/** KPI tile: label, big tabular value, optional target progress and hint. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  target,
  current,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** when given with `current`, renders a progress bar toward target */
  target?: number;
  current?: number;
  className?: string;
}) {
  const pct = target && typeof current === "number" ? Math.min(100, Math.round((current / target) * 100)) : null;
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", toneClasses[tone])} aria-hidden>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="tabular mt-1 text-[1.75rem] font-bold leading-tight tracking-tight">{value}</p>
      {pct !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className={cn("h-full rounded-full transition-[width] duration-500", toneBar[tone])} style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
