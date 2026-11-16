"use client";
import { useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/form";
import { buildHref } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterSelect = {
  name: string;
  label: string;
  options: FilterOption[];
  /** current value from the URL ("" = all) */
  value?: string;
  /** label of the "no filter" option; omit for selects that always have a value (e.g. sort) */
  allLabel?: string;
  /** wider select (long option labels) */
  wide?: boolean;
};
/** A calendar-date filter (yyyy-mm-dd, Baku calendar day) */
export type FilterDate = { name: string; label: string; value?: string };

/**
 * The one filter bar for list pages. State lives in the URL (server pages read searchParams):
 * selects apply on change, the search applies 400 ms after typing or on Enter, "Apply" is the no-JS fallback,
 * "Clear filters" keeps only `keep` params. `variant="inline"` sits inside a list card header (border-b p-4).
 */
export function FilterBar({
  action,
  search,
  selects = [],
  dates = [],
  keep = {},
  variant = "card",
  className,
}: {
  action: string;
  search?: { name?: string; label: string; placeholder: string; value?: string };
  selects?: FilterSelect[];
  dates?: FilterDate[];
  /** params that are not filters but must survive (view, tab, sort…) */
  keep?: Record<string, string | undefined>;
  variant?: "card" | "inline";
  className?: string;
}) {
  const t = useTranslations("common.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchName = search?.name ?? "q";
  const active = !!search?.value || selects.some((s) => s.allLabel && s.value) || dates.some((d) => d.value);

  function go(form: HTMLFormElement) {
    if (timer.current) clearTimeout(timer.current);
    const params: Record<string, string | undefined> = { ...keep };
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v.trim() && k !== "page") params[k] = v.trim();
    }
    startTransition(() => router.replace(buildHref(action, params), { scroll: false }));
  }

  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        const el = e.target as HTMLElement;
        if (el.tagName === "SELECT" || (el as HTMLInputElement).type === "date") go(e.currentTarget);
      }}
      className={cn(
        "grid grid-cols-2 gap-3 sm:items-end lg:flex lg:flex-nowrap",
        variant === "card" ? "rounded-xl border bg-card p-4 shadow-card" : "border-b p-4",
        className,
      )}
    >
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {search && (
        <div className="col-span-2 grid min-w-0 gap-1.5 lg:min-w-48 lg:flex-1">
          <label htmlFor="filter-q" className="text-xs font-medium text-muted-foreground">{search.label}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="filter-q"
              name={searchName}
              type="search"
              defaultValue={search.value ?? ""}
              placeholder={search.placeholder}
              autoComplete="off"
              className="pl-8"
              onChange={(e) => {
                const form = e.currentTarget.form;
                if (timer.current) clearTimeout(timer.current);
                if (form) timer.current = setTimeout(() => go(form), 400);
              }}
            />
          </div>
        </div>
      )}
      {selects.map((s) => (
        <div key={s.name} className={cn("grid min-w-0 gap-1.5 lg:min-w-32 lg:shrink", s.wide ? "lg:w-56" : "lg:w-44")}>
          <label htmlFor={`filter-${s.name}`} className="text-xs font-medium text-muted-foreground">{s.label}</label>
          <NativeSelect id={`filter-${s.name}`} name={s.name} defaultValue={s.value ?? ""} key={`${s.name}:${s.value ?? ""}`}>
            {s.allLabel !== undefined && <option value="">{s.allLabel}</option>}
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        </div>
      ))}
      {dates.map((d) => (
        <div key={d.name} className="grid min-w-0 gap-1.5 lg:w-40 lg:shrink-0">
          <label htmlFor={`filter-${d.name}`} className="text-xs font-medium text-muted-foreground">{d.label}</label>
          <Input id={`filter-${d.name}`} name={d.name} type="date" defaultValue={d.value ?? ""} key={`${d.name}:${d.value ?? ""}`} />
        </div>
      ))}
      <div className="col-span-2 flex shrink-0 items-center gap-2 lg:col-span-1">
        <Button type="submit" variant="outline" size="lg">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          {t("apply")}
        </Button>
        {active && (
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href={buildHref(action, keep)} scroll={false} />}>
            <X aria-hidden />
            {t("clear")}
          </Button>
        )}
      </div>
    </form>
  );
}
