import Link from "next/link";
import { cn } from "@/lib/utils";

export type BarItem = { key: string; label: React.ReactNode; sub?: React.ReactNode; value: number; href?: string; title: string };

/** Ranked horizontal bars, one hue, numbers always visible (no tooltip needed to read values). */
export function BarList({ items, total, label, className }: { items: BarItem[]; total?: number; label: string; className?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const sum = total ?? items.reduce((a, i) => a + i.value, 0);
  return (
    <ul aria-label={label} className={cn("space-y-1", className)}>
      {items.map((it) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {it.label}
                {it.sub && <span className="ml-1.5 text-xs text-muted-foreground">{it.sub}</span>}
              </span>
              <span className="shrink-0">
                <span className="tabular font-semibold">{it.value}</span>
                <span className="tabular ml-2 inline-block w-9 text-right text-xs text-muted-foreground">{sum ? Math.round((it.value / sum) * 100) : 0}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${(it.value / max) * 100}%` }} />
            </div>
          </>
        );
        return (
          <li key={it.key} title={it.title}>
            {it.href ? (
              <Link
                href={it.href}
                className="-mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {body}
              </Link>
            ) : (
              <div className="py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
