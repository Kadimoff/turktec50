"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterSelect } from "@/components/shared/filter-bar";
import { cn } from "@/lib/utils";
import { PRIORITIES, TASK_STATUSES } from "./types";

type Option = { id: string; label: string };

/**
 * Task filters (project, owner, status, priority, due, q) on the shared FilterBar. With more than four selects the bar
 * folds behind a "Filters" toggle on phones.
 */
export function TaskFilters({
  action,
  values,
  view,
  projects,
  members,
  showMine,
}: {
  /** list path (/tasks or /projects/[id]/tasks) */
  action: string;
  /** current filter values from the URL */
  values: { project?: string; assignee?: string; status?: string; priority?: string; due?: string; q?: string };
  /** current ?view= (kept when filtering / clearing) */
  view?: string;
  /** project options (ADMIN / MENTOR on /tasks) */
  projects?: Option[];
  /** member options when a single project is in context */
  members?: Option[];
  showMine: boolean;
}) {
  const t = useTranslations("tasks.filters");
  const te = useTranslations("enums");
  const [expanded, setExpanded] = useState(false);

  const selects: FilterSelect[] = [
    ...(projects && projects.length > 1
      ? [{ name: "project", label: t("project"), allLabel: t("allProjects"), value: values.project, wide: true, options: projects.map((p) => ({ value: p.id, label: p.label })) }]
      : []),
    {
      name: "assignee",
      label: t("assignee"),
      allLabel: t("anyone"),
      value: values.assignee,
      options: [
        ...(showMine ? [{ value: "mine", label: t("mine") }] : []),
        { value: "none", label: t("unassigned") },
        ...(members ?? []).map((m) => ({ value: m.id, label: m.label })),
      ],
    },
    {
      name: "status",
      label: t("status"),
      allLabel: t("anyStatus"),
      value: values.status,
      options: [{ value: "open", label: t("open") }, ...TASK_STATUSES.map((s) => ({ value: s, label: te(`TaskStatus.${s}`) }))],
    },
    { name: "priority", label: t("priority"), allLabel: t("anyPriority"), value: values.priority, options: PRIORITIES.map((p) => ({ value: p, label: te(`Priority.${p}`) })) },
    {
      name: "due",
      label: t("due"),
      allLabel: t("anyDue"),
      value: values.due,
      options: [
        { value: "overdue", label: t("overdue") },
        { value: "week", label: t("week") },
        { value: "later", label: t("later") },
      ],
    },
  ];
  const foldable = selects.length > 4;
  const active = (values.q ? 1 : 0) + selects.filter((s) => s.value).length;

  return (
    <div className="grid gap-3">
      {foldable && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-between sm:hidden"
          aria-expanded={expanded}
          aria-controls="task-filters"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("label")}
          </span>
          {active > 0 && (
            <span className="tabular rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground" aria-label={t("active", { count: active })}>
              {active}
            </span>
          )}
        </Button>
      )}
      <div id="task-filters" className={cn(foldable && !expanded && "max-sm:hidden")}>
        <FilterBar
          action={action}
          search={{ label: t("search"), placeholder: t("searchPlaceholder"), value: values.q }}
          selects={selects}
          keep={{ view }}
        />
      </div>
    </div>
  );
}
