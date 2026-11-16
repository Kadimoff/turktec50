"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { withdrawIntake } from "@/app/(public)/apply/actions";

/** Withdraw through the tracking link (confirmation first). The action re-checks the status server-side. */
export function WithdrawButton({ token, code }: { token: string; code: string }) {
  const t = useTranslations("intake");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await withdrawIntake(token);
      if (res.ok) {
        toast.success(t("status.withdrawn"), { description: code });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger render={<Button variant="outline" className="h-10 text-danger hover:text-danger" />}>
        <Undo2 aria-hidden />
        {t("status.withdraw")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-danger-soft text-danger">
            <Undo2 aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("status.withdrawTitle", { code })}</AlertDialogTitle>
          <AlertDialogDescription>{t("status.withdrawBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t("status.withdrawing") : t("status.withdrawConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
