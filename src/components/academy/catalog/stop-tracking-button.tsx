"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { stopTracking } from "@/app/(app)/academy/catalog/actions";

/** ADMIN: stop 2027 rule tracking (confirmation required). */
export function StopTrackingButton({ competitionId, name }: { competitionId: string; name: string }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await stopTracking(competitionId);
      if (res.ok) {
        toast.success(t((res.message ?? "toast.stopped") as never), { description: name });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="lg" className="text-muted-foreground hover:text-danger" aria-label={t("stop.label", { name })} />}
      >
        <EyeOff aria-hidden />
        {t("stop.trigger")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-danger-soft text-danger">
            <EyeOff aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("stop.title")}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{t("stop.description", { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t("stop.pending") : t("stop.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
