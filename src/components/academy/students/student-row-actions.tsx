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
import { deleteStudent } from "@/app/(app)/academy/students/actions";
import { StudentFormDialog } from "./student-form-dialog";
import type { StudentFormValue } from "./types";

export function StudentRowActions({ student }: { student: StudentFormValue }) {
  const t = useTranslations("teams");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await deleteStudent(student.id);
      if (res.ok) {
        toast.success(t((res.message ?? "toast.studentDeleted") as never), { description: student.name });
        setOpen(false);
      } else toast.error(t((res.message ?? "errors.generic") as never));
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <StudentFormDialog mode="edit" student={student} />
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-danger" aria-label={t("students.actions.deleteLabel", { name: student.name })} />}
        >
          <Trash2 aria-hidden />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger-soft text-danger">
              <Trash2 aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("students.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {student.teamName
                ? t(student.isCaptain ? "students.delete.bodyCaptain" : "students.delete.bodyTeam", { name: student.name, team: student.teamName })
                : t("students.delete.body", { name: student.name })}
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
