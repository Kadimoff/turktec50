"use client";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TaskStatusMenu } from "./task-status-menu";
import { TaskRowActions } from "./task-row-actions";
import { Assignee, Criterion, PriorityBadge, ProjectCode, SourceSessionChip } from "./task-bits";
import { DueLabel } from "./due-label";
import { useTaskContext } from "./task-context";
import type { TaskItem } from "./types";

/** Desktop table (md+) and stacked rows on mobile. Status changes inline. */
export function TaskTable({ items, caption }: { items: TaskItem[]; caption: string }) {
  const t = useTranslations("tasks.columns");
  const { showProject } = useTaskContext();
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-72 pl-4 text-xs font-semibold text-muted-foreground">{t("task")}</TableHead>
              {showProject && <TableHead className="text-xs font-semibold text-muted-foreground">{t("project")}</TableHead>}
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("assignee")}</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("due")}</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("priority")}</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("status")}</TableHead>
              <TableHead className="w-12 pr-3 text-xs font-semibold text-muted-foreground">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((task) => (
              <TableRow key={task.id} className="hover:bg-muted/50">
                <TableCell className="max-w-md py-2.5 pl-4 whitespace-normal">
                  <p className="text-sm font-medium text-pretty">{task.title}</p>
                  <Criterion text={task.acceptanceCriteria} className="mt-0.5" />
                  {task.source && (
                    <div className="mt-1">
                      <SourceSessionChip task={task} />
                    </div>
                  )}
                </TableCell>
                {showProject && (
                  <TableCell>
                    <ProjectCode task={task} />
                    <p className="max-w-40 truncate text-xs text-muted-foreground">{task.projectTitle}</p>
                  </TableCell>
                )}
                <TableCell className="max-w-44">
                  <Assignee task={task} />
                </TableCell>
                <TableCell>
                  <DueLabel task={task} icon={false} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell>
                  <TaskStatusMenu task={task} className="-ml-1" />
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <TaskRowActions task={task} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden" aria-label={caption}>
        {items.map((task) => (
          <TaskListRow key={task.id} task={task} />
        ))}
      </ul>
    </>
  );
}

/** Stacked row (mobile table + week view). */
export function TaskListRow({ task, className }: { task: TaskItem; className?: string }) {
  const { showProject } = useTaskContext();
  return (
    <li className={cn("rounded-xl border bg-card p-3 shadow-card", task.overdue && "border-l-2 border-l-danger", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showProject && <ProjectCode task={task} />}
          <p className="text-sm leading-snug font-medium text-pretty">{task.title}</p>
          <Criterion text={task.acceptanceCriteria} className="mt-0.5" />
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Assignee task={task} compact />
        <DueLabel task={task} />
        <SourceSessionChip task={task} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <TaskStatusMenu task={task} className="-ml-1" />
        <TaskRowActions task={task} />
      </div>
    </li>
  );
}
