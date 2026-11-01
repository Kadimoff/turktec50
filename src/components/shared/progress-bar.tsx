import { cn } from "@/lib/utils";
import { toneBar, type Tone } from "@/lib/tones";

export function ProgressBar({
  value,
  tone,
  label,
  showValue = true,
  className,
}: {
  value: number;
  tone?: Tone;
  label: string; // accessible name (also visible when showValue)
  showValue?: boolean;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const autoTone: Tone = tone ?? (v >= 70 ? "success" : v >= 45 ? "brand" : "warning");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full", toneBar[autoTone])} style={{ width: `${v}%` }} />
      </div>
      {showValue && <span className="tabular w-9 text-right text-xs font-semibold text-foreground">{v}%</span>}
    </div>
  );
}
