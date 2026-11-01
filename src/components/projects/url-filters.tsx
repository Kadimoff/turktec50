"use client";
import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/form";
import { cn } from "@/lib/utils";

export type FilterDef = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  /** label of the "no filter" option; omit for selects that always have a value (e.g. sort) */
  allLabel?: string;
  defaultValue?: string;
};

/** Filter bar bound to URL search params (resets ?page on change). Works with server-rendered lists. */
export function UrlFilters({
  search,
  filters,
  resetLabel,
  className,
}: {
  search: { label: string; placeholder: string };
  filters: FilterDef[];
  resetLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const s = next.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  }

  const active = filters.some((f) => f.allLabel && params.get(f.name)) || !!params.get("q");

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-card sm:p-4 lg:flex-row lg:items-end", className)}>
      <form
        role="search"
        className="grid min-w-0 flex-1 gap-1.5 lg:max-w-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          push({ q: q.trim() || undefined });
        }}
      >
        <label htmlFor="filter-q" className="text-xs font-semibold tracking-wide text-muted-foreground">
          {search.label}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="filter-q"
            type="search"
            value={q}
            placeholder={search.placeholder}
            className="h-9 pl-8"
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => push({ q: v.trim() || undefined }), 400);
            }}
          />
        </div>
      </form>
      <div className="grid flex-[2] grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
        {filters.map((f) => (
          <div key={f.name} className="grid min-w-0 gap-1.5 lg:w-44">
            <label htmlFor={`filter-${f.name}`} className="text-xs font-semibold tracking-wide text-muted-foreground">
              {f.label}
            </label>
            <NativeSelect
              id={`filter-${f.name}`}
              value={params.get(f.name) ?? f.defaultValue ?? ""}
              onChange={(e) => push({ [f.name]: e.target.value || undefined })}
            >
              {f.allLabel && <option value="">{f.allLabel}</option>}
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <div className="col-span-full flex h-9 items-center gap-2 empty:hidden lg:col-span-1">
          {active && (
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setQ("");
                const next = new URLSearchParams();
                for (const f of filters) if (!f.allLabel && params.get(f.name)) next.set(f.name, params.get(f.name)!);
                const s = next.toString();
                startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
              }}
            >
              <X aria-hidden />
              {resetLabel}
            </Button>
          )}
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
        </div>
      </div>
    </div>
  );
}
