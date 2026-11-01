"use client";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToneBadge } from "@/components/shared/tone-badge";
import { taskStatusTone, toneBar } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUSES, type TaskItem } from "./types";

/** Server call + toast for a status change. */
export function useStatusChange() {
  const t = useTranslations("tasks");
  const te = useTranslations("enums");
  return async (id: string, status: TaskStatus) => {
    const r = await setTaskStatus(id, status);
    if (r.ok) toast.success(t("status.changed", { status: te(`TaskStatus.${status}`) }));
    else toast.error(t(r.error ?? "errors.generic"));
    return r;
  };
}

/**
 * Keyboard-accessible status menu (badge = trigger). When `onChange` is given (board) the parent owns the optimistic
 * state; otherwise this component updates optimistically itself.
 */
export function TaskStatusMenu({
  task,
  onChange,
  className,
}: {
  task: TaskItem;
  onChange?: (status: TaskStatus) => void;
  className?: string;
}) {
  const t = useTranslations("tasks");
  const te = useTranslations("enums");
  const change = useStatusChange();
  const [pending, start] = useTransition();
  const [status, setOptimistic] = useOptimistic(task.status);
  const label = te(`TaskStatus.${status}`);

  if (!task.canEdit) return <ToneBadge tone={taskStatusTone[status]}>{label}</ToneBadge>;

  const select = (value: TaskStatus) => {
    if (value === status) return;
    if (onChange) return onChange(value);
    start(async () => {
      setOptimistic(value);
      await change(task.id, value);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("status.change", { status: label })}
            disabled={pending}
            className={cn("h-8 gap-0.5 rounded-full px-1 hover:bg-muted", className)}
          />
        }
      >
        <ToneBadge tone={taskStatusTone[status]}>{label}</ToneBadge>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("status.menuLabel")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={status} onValueChange={(v) => select(v as TaskStatus)}>
            {TASK_STATUSES.map((s) => (
              <DropdownMenuRadioItem key={s} value={s} disabled={s === "DONE" && !task.canComplete}>
                <span aria-hidden className={cn("size-2 rounded-full", toneBar[taskStatusTone[s]])} />
                {te(`TaskStatus.${s}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {!task.canComplete && <p className="px-1.5 pt-1 pb-1.5 text-xs text-muted-foreground">{t("errors.mentorNoDone")}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
