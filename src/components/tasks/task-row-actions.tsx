"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTask } from "@/app/(app)/tasks/actions";
import { EditTaskDialog } from "./task-dialog";
import { useTaskContext } from "./task-context";
import type { TaskItem } from "./types";

/** "⋯" menu with edit / open project / delete (AlertDialog). */
export function TaskRowActions({ task }: { task: TaskItem }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { showProject } = useTaskContext();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!task.canEdit && !task.canDelete && !showProject) return null;

  const onDelete = () =>
    start(async () => {
      const r = await deleteTask(task.id);
      if (r.ok) {
        toast.success(t("toast.deleted"));
        setDeleteOpen(false);
      } else toast.error(t(r.error ?? "errors.generic"));
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={t("actions.more", { title: task.title })} className="size-8 text-muted-foreground" />}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {task.canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              {t("actions.edit")}
            </DropdownMenuItem>
          )}
          {showProject && (
            <DropdownMenuItem render={<Link href={`/projects/${task.projectId}/tasks`} />}>
              <ExternalLink aria-hidden />
              {t("actions.openProject")}
            </DropdownMenuItem>
          )}
          {task.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                {t("actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {task.canEdit && <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />}

      {task.canDelete && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("delete.description", { title: task.title })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
              <Button variant="destructive" onClick={onDelete} disabled={pending} aria-busy={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {pending ? t("delete.pending") : t("delete.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
