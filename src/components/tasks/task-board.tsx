"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { taskStatusTone, toneBar } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TaskStatusMenu, useStatusChange } from "./task-status-menu";
import { TaskRowActions } from "./task-row-actions";
import { Assignee, Criterion, PriorityBadge, ProjectCode, SourceSessionChip } from "./task-bits";
import { DueLabel } from "./due-label";
import { useTaskContext } from "./task-context";
import { TASK_STATUSES, type TaskItem } from "./types";

type Move = { id: string; status: TaskStatus };

/**
 * Kanban board. Status changes via the card's status menu (keyboard accessible);
 * HTML5 drag & drop between columns is a progressive enhancement only.
 */
export function TaskBoard({
  items,
  counts,
  tableHrefs,
}: {
  items: TaskItem[];
  counts: Record<TaskStatus, number>;
  /** when columns are capped: link per status to the full table view */
  tableHrefs?: Partial<Record<TaskStatus, string>>;
}) {
  const t = useTranslations("tasks");
  const te = useTranslations("enums");
  const { showProject } = useTaskContext();
  const change = useStatusChange();
  const [, start] = useTransition();
  const [optimistic, applyMove] = useOptimistic(items, (state: TaskItem[], m: Move) =>
    state.map((it) => (it.id === m.id ? { ...it, status: m.status, overdue: m.status === "DONE" ? false : it.overdue } : it)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const move = (task: TaskItem, status: TaskStatus) => {
    if (task.status === status) return;
    if (status === "DONE" && !task.canComplete) {
      toast.error(t("errors.mentorNoDone"));
      return;
    }
    start(async () => {
      applyMove({ id: task.id, status });
      await change(task.id, status);
    });
  };

  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskItem[]])) as Record<TaskStatus, TaskItem[]>;
  for (const it of optimistic) byStatus[it.status].push(it);
  // keep true totals in sync with optimistic moves
  const shown = (s: TaskStatus) => counts[s] + byStatus[s].length - items.filter((i) => i.status === s).length;

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" role="region" aria-label={t("board.label")} tabIndex={0}>
      <p className="sr-only">{t("board.dragHint")}</p>
      <div className="grid min-w-max auto-cols-[17.5rem] grid-flow-col items-start gap-3 lg:items-stretch xl:min-w-0 xl:auto-cols-[minmax(15rem,1fr)]">
        {TASK_STATUSES.map((status) => {
          const list = byStatus[status];
          const total = shown(status);
          const hidden = total - list.length;
          const headingId = `col-${status}`;
          return (
            <section
              key={status}
              aria-labelledby={headingId}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== status) setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                const task = optimistic.find((i) => i.id === id);
                setOver(null);
                setDragId(null);
                if (task) move(task, status);
              }}
              className={cn(
                "flex min-h-40 flex-col rounded-xl border bg-muted/40 transition-colors duration-150",
                over === status && "border-primary bg-accent/60",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className={cn("size-2 rounded-full", toneBar[taskStatusTone[status]])} />
                  {te(`TaskStatus.${status}`)}
                </h3>
                <span className="tabular rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                  <span className="sr-only">{t("board.countLabel")}: </span>
                  {total}
                </span>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2 lg:max-h-[calc(100dvh-17rem)] lg:overflow-y-auto">
                {list.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    {over === status ? t("board.dropHint") : t("board.empty")}
                  </li>
                )}
                {list.map((task) => (
                  <li
                    key={task.id}
                    draggable={task.canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(task.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    className={cn(
                      "group rounded-lg border bg-card p-3 shadow-card transition-opacity duration-150",
                      task.canEdit && "lg:cursor-grab lg:active:cursor-grabbing",
                      dragId === task.id && "opacity-50",
                      task.overdue && "border-l-2 border-l-danger",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {showProject ? <ProjectCode task={task} /> : <span className="text-[11px] font-medium text-muted-foreground">{task.week ? t("weekLabel", { n: task.week }) : ""}</span>}
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <p className="mt-1.5 text-sm leading-snug font-medium text-pretty">{task.title}</p>
                    <Criterion text={task.acceptanceCriteria} className="mt-1" />
                    {task.source && (
                      <div className="mt-2">
                        <SourceSessionChip task={task} />
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                      <Assignee task={task} compact />
                      <DueLabel task={task} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                      <TaskStatusMenu task={task} onChange={(s) => move(task, s)} className="-ml-1" />
                      <TaskRowActions task={task} />
                    </div>
                  </li>
                ))}
                {hidden > 0 && tableHrefs?.[status] && (
                  <li className="pt-1">
                    <Link
                      href={tableHrefs[status]!}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background px-3 py-2.5 text-xs font-medium text-primary hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {t("board.more", { count: hidden })} · {t("board.showAllInTable")}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
