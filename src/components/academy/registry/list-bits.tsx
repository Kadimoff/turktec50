import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";

/** Card wrapper of a registry list: title, result count and the create action. */
export function ListSection({ id, title, found, action, children }: { id: string; title: string; found: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-card" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={id} className="text-sm font-semibold">{title}</h2>
          <p className="tabular text-xs text-muted-foreground" aria-live="polite">{found}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Th({ children, className, numeric }: { children: React.ReactNode; className?: string; numeric?: boolean }) {
  return <TableHead className={cn("text-xs font-semibold text-muted-foreground", numeric && "text-right", className)}>{children}</TableHead>;
}

/** Right-aligned tabular count; zero is muted so the used ones stand out. */
export function Count({ value }: { value: number }) {
  return <span className={cn("tabular", value === 0 && "text-muted-foreground")}>{value}</span>;
}

/** Mobile card: counts as small chips ("12 students"). */
export function CountChips({ items }: { items: { key: string; label: string; value: number }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.key} className={cn("tabular rounded-full px-2 py-0.5 text-xs", i.value > 0 ? "bg-muted font-medium text-foreground" : "bg-muted/60 text-muted-foreground")}>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Free-text notes: plain text, line breaks kept, clamped in lists. */
export function Notes({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return <p className={cn("line-clamp-2 whitespace-pre-line text-xs text-muted-foreground", className)} title={text}>{text}</p>;
}
