// Small server-safe building blocks shared by dashboard / kpi / calendar views.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { dfLocale, fmtDate, fmtDay } from "@/lib/format";
import type { Tone } from "@/lib/tones";

export function Panel({
  id,
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-card", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 no-print">{action}</div>}
      </header>
      <div className={cn("flex-1 px-4 pb-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small "view all →" link used in panel headers. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-0.5 rounded-md px-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
      <ChevronRight className="size-3.5" aria-hidden />
    </Link>
  );
}

type Tr = (key: string, values?: Record<string, string | number>) => string;

/** Relative + absolute date label: "2 gün qalıb · 20 okt" / "Gecikib · 18 okt". */
export function dueLabel(d: Date, tc: Tr, locale: string, now = new Date()): { text: string; tone: Tone; overdue: boolean } {
  const diff = differenceInCalendarDays(d, now);
  const day = fmtDay(d, locale);
  if (d < now) return { text: `${tc("overdue")} · ${day}`, tone: "danger", overdue: true };
  if (diff === 0) return { text: `${tc("today")} · ${day}`, tone: "warning", overdue: false };
  if (diff === 1) return { text: `${tc("tomorrow")} · ${day}`, tone: "warning", overdue: false };
  return { text: `${tc("daysLeft", { count: diff })} · ${day}`, tone: diff <= 7 ? "info" : "neutral", overdue: false };
}

export function DueText({ d, tc, locale, className }: { d: Date; tc: Tr; locale: string; className?: string }) {
  const l = dueLabel(d, tc, locale);
  return (
    <time dateTime={d.toISOString()} className={cn("tabular text-xs whitespace-nowrap", l.overdue ? "font-semibold text-danger" : "text-muted-foreground", className)}>
      {l.text}
    </time>
  );
}

/** A compact clickable list row (≥44px) with left content and right meta. */
export function RowLink({ href, children, meta, className }: { href: string; children: React.ReactNode; meta?: React.ReactNode; className?: string }) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {meta && <div className="flex shrink-0 flex-col items-end gap-1 text-right">{meta}</div>}
      </Link>
    </li>
  );
}

export function MiniEmpty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">{children}</p>;
}

export function ProjectCode({ children }: { children: React.ReactNode }) {
  return <span className="tabular rounded bg-muted px-1.5 py-px font-mono text-[11px] font-medium text-muted-foreground">{children}</span>;
}

/** Calendar-style day chip (weekday + day number) with an sr-only full date. */
export function DayChip({ date, locale, highlight, className }: { date: Date; locale: string; highlight?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex w-11 shrink-0 flex-col items-center self-start rounded-lg border py-1 leading-none",
        highlight ? "border-primary/40 bg-accent text-accent-foreground" : "bg-background",
        className,
      )}
    >
      <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">{format(date, "EEEEEE", { locale: dfLocale(locale) })}</span>
      <span aria-hidden className="tabular mt-0.5 text-base font-bold">{format(date, "d")}</span>
      <span className="sr-only">{fmtDate(date, locale)}</span>
    </span>
  );
}
