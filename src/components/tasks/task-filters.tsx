"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { PRIORITIES, TASK_STATUSES } from "./types";

type Option = { id: string; label: string };

/** Filter bar bound to searchParams (project, assignee, status, priority, due, q). */
export function TaskFilters({
  projects,
  members,
  showMine,
}: {
  /** project options (ADMIN / MENTOR on /tasks) */
  projects?: Option[];
  /** member options when a single project is in context */
  members?: Option[];
  showMine: boolean;
}) {
  const t = useTranslations("tasks.filters");
  const te = useTranslations("enums");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    // a member filter belongs to one project; reset it when the project changes
    if ("project" in patch && next.get("assignee") && !["mine", "none"].includes(next.get("assignee")!)) next.delete("assignee");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const onQ = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: v.trim() || null }), 350);
  };

  const active = ["project", "assignee", "status", "priority", "due", "q"].filter((k) => sp.get(k)).length;
  const sel = "h-9";
  const showProjects = !!projects && projects.length > 1;

  return (
    <form
      role="search"
      aria-label={t("label")}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        push({ q: q.trim() || null });
      }}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-3 shadow-card sm:grid-cols-2 lg:items-end",
        showProjects ? "lg:grid-cols-[minmax(12rem,1.4fr)_repeat(5,minmax(0,1fr))_auto]" : "lg:grid-cols-[minmax(12rem,1.6fr)_repeat(4,minmax(0,1fr))_auto]",
      )}
    >
      <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="tf-q" className="text-xs font-medium text-muted-foreground">
          {t("search")}
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="tf-q" type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-9 pl-8" />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-9 justify-between sm:hidden"
        aria-expanded={expanded}
        aria-controls="tf-more"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("label")}
        </span>
        {active > 0 && <span className="tabular rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{active}</span>}
      </Button>

      <div id="tf-more" className={cn("contents", !expanded && "max-sm:hidden")}>
      {showProjects ? (
        <FilterSelect id="tf-project" label={t("project")} value={sp.get("project") ?? ""} onChange={(v) => push({ project: v })} className={sel}>
          <option value="">{t("allProjects")}</option>
          {projects!.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </FilterSelect>
      ) : null}

      <FilterSelect id="tf-assignee" label={t("assignee")} value={sp.get("assignee") ?? ""} onChange={(v) => push({ assignee: v })} className={sel}>
        <option value="">{t("anyone")}</option>
        {showMine && <option value="mine">{t("mine")}</option>}
        <option value="none">{t("unassigned")}</option>
        {members?.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect id="tf-status" label={t("status")} value={sp.get("status") ?? ""} onChange={(v) => push({ status: v })} className={sel}>
        <option value="">{t("anyStatus")}</option>
        <option value="open">{t("open")}</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {te(`TaskStatus.${s}`)}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect id="tf-priority" label={t("priority")} value={sp.get("priority") ?? ""} onChange={(v) => push({ priority: v })} className={sel}>
        <option value="">{t("anyPriority")}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {te(`Priority.${p}`)}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect id="tf-due" label={t("due")} value={sp.get("due") ?? ""} onChange={(v) => push({ due: v })} className={sel}>
        <option value="">{t("anyDue")}</option>
        <option value="overdue">{t("overdue")}</option>
        <option value="week">{t("week")}</option>
        <option value="later">{t("later")}</option>
      </FilterSelect>

      </div>

      <div className={cn("flex items-center gap-2 sm:col-span-2 lg:col-span-1", !expanded && "max-sm:hidden")}>
        <Button
          type="button"
          variant="ghost"
          className="h-9"
          disabled={active === 0 || pending}
          onClick={() => {
            setQ("");
            const keep = new URLSearchParams();
            const view = sp.get("view");
            if (view) keep.set("view", view);
            const qs = keep.toString();
            start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
          {t("reset")}
        </Button>
        <span className="sr-only" aria-live="polite">
          {pending ? t("loading") : t("active", { count: active })}
        </span>
      </div>
    </form>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  className,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        {children}
      </NativeSelect>
    </div>
  );
}
