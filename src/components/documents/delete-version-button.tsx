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
import { deleteDocument } from "@/app/(app)/projects/[id]/documents/actions";

export function DeleteVersionButton({ documentId, fileName, version }: { documentId: string; fileName: string; version: number }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteDocument(documentId);
      if (res.ok) {
        toast.success(t("toast.deleted"), { description: `${fileName} · v${version}` });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger
        render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-danger" aria-label={t("delete.label", { n: version })} />}
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-danger-soft text-danger">
            <Trash2 aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{t("delete.description", { name: fileName, n: version })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t("delete.pending") : t("delete.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
