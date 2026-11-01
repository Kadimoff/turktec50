"use client";
import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskItem } from "./types";

/** Relative + absolute due date ("2 gün qalıb · 20 okt"); overdue in danger (with text, not color only). */
export function DueLabel({ task, className, icon = true }: { task: TaskItem; className?: string; icon?: boolean }) {
  const t = useTranslations("tasks.due");
  if (task.status === "DONE") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        {icon && <CalendarClock className="size-3.5 shrink-0" aria-hidden />}
        <span className="tabular">{task.completedAbs ? t("completed", { date: task.completedAbs }) : task.dueAbs}</span>
      </span>
    );
  }
  let rel: string;
  if (task.overdue) rel = task.dueDays >= 0 ? t("overdueToday") : t("overdueDays", { count: -task.dueDays });
  else if (task.dueDays === 0) rel = t("today");
  else if (task.dueDays === 1) rel = t("tomorrow");
  else rel = t("daysLeft", { count: task.dueDays });
  const soon = !task.overdue && task.dueDays <= 2;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        task.overdue ? "font-semibold text-danger" : soon ? "font-medium text-warning" : "text-muted-foreground",
        className,
      )}
    >
      {icon && <CalendarClock className="size-3.5 shrink-0" aria-hidden />}
      <span className="tabular whitespace-nowrap">
        {rel} · {task.dueAbs}
      </span>
    </span>
  );
}
