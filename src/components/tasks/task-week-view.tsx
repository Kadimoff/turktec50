"use client";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/shared/progress-bar";
import { cn } from "@/lib/utils";
import { TaskListRow } from "./task-table";
import { useTaskContext } from "./task-context";
import type { TaskItem } from "./types";

/** Tasks grouped by program week (1–8), current week highlighted. */
export function TaskWeekView({ items }: { items: TaskItem[] }) {
  const t = useTranslations("tasks");
  const { currentWeek } = useTaskContext();
  const groups = new Map<number | null, TaskItem[]>();
  for (const it of items) {
    const k = it.week ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const keys = [...groups.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));
  return (
    <div className="space-y-4">
      {keys.map((week) => {
        const list = groups.get(week)!;
        const done = list.filter((i) => i.status === "DONE").length;
        const current = week === currentWeek;
        const id = `week-${week ?? "none"}`;
        return (
          <section key={id} aria-labelledby={id} className={cn("rounded-xl border bg-card/50 p-3 sm:p-4", current && "border-primary/60 ring-1 ring-primary/20")}>
            <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h3 id={id} className="text-sm font-semibold">
                  {week ? t("weekLabel", { n: week }) : t("noWeek")}
                </h3>
                {current && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{t("weekView.current")}</span>}
              </div>
              <div className="flex items-center gap-3 sm:w-64">
                <span className="tabular shrink-0 text-xs text-muted-foreground">{t("weekView.progress", { done, total: list.length })}</span>
                <ProgressBar value={(done / list.length) * 100} label={t("weekView.progress", { done, total: list.length })} showValue={false} className="flex-1" />
              </div>
            </header>
            <ul className="grid gap-2 lg:grid-cols-2">
              {list.map((task) => (
                <TaskListRow key={task.id} task={task} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
