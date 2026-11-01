"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Equal, MessagesSquare } from "lucide-react";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { priorityTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { TaskItem } from "./types";

const priorityIcon = { HIGH: ArrowUp, MEDIUM: Equal, LOW: ArrowDown } as const;

export function PriorityBadge({ priority }: { priority: TaskItem["priority"] }) {
  const te = useTranslations("enums");
  const Icon = priorityIcon[priority];
  return (
    <ToneBadge tone={priorityTone[priority]} dot={false} className="gap-1 px-2">
      <Icon className="size-3" aria-hidden />
      {te(`Priority.${priority}`)}
    </ToneBadge>
  );
}

export function Assignee({ task, compact }: { task: TaskItem; compact?: boolean }) {
  const t = useTranslations("tasks");
  if (!task.assignee) return <span className="text-xs text-muted-foreground italic">{t("noAssignee")}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar name={task.assignee.name} size="sm" className={cn(compact && "size-6 text-[10px]")} />
      <span aria-hidden className="truncate text-xs font-medium">{task.assignee.name}</span>
    </span>
  );
}

export function SourceSessionChip({ task }: { task: TaskItem }) {
  const t = useTranslations("tasks");
  if (!task.source) return null;
  return (
    <Link
      href={`/projects/${task.projectId}/sessions#session-${task.source.id}`}
      title={t("fromSessionTitle", { topic: task.source.topic })}
      className="inline-flex max-w-full items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <MessagesSquare className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{t("fromSession")}</span>
      <span className="sr-only">: {task.source.topic}</span>
    </Link>
  );
}

export function Criterion({ text, clamp = true, className }: { text: string | null; clamp?: boolean; className?: string }) {
  const t = useTranslations("tasks");
  if (!text) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", clamp && "line-clamp-2", className)}>
      <span className="font-semibold text-foreground/70">{t("criterion")}:</span> {text}
    </p>
  );
}

export function ProjectCode({ task }: { task: TaskItem }) {
  return (
    <Link
      href={`/projects/${task.projectId}/tasks`}
      title={task.projectTitle}
      className="font-mono text-[11px] font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {task.projectCode}
      <span className="sr-only"> · {task.projectTitle}</span>
    </Link>
  );
}
