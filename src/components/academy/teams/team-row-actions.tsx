"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTeam } from "@/app/(app)/academy/teams/actions";
import { TeamFormDialog } from "./team-form-dialog";
import type { TeamFormValue } from "./types";

export function TeamRowActions({ team, applications }: { team: TeamFormValue; applications: number }) {
  const t = useTranslations("teams");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await deleteTeam(team.id);
      if (res.ok) {
        toast.success(t((res.message ?? "toast.teamDeleted") as never), { description: team.name });
        setOpen(false);
      } else toast.error(t((res.message ?? "errors.generic") as never));
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <TeamFormDialog mode="edit" team={team} />
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-danger" aria-label={t("teams.actions.deleteLabel", { name: team.name })} />}
        >
          <Trash2 aria-hidden />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger-soft text-danger">
              <Trash2 aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("teams.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {t("teams.delete.body", { name: team.name, count: team.memberIds.length })}
              {applications > 0 && ` ${t("teams.delete.applications", { count: applications })}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={onConfirm} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? t("form.deleting") : tc("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
