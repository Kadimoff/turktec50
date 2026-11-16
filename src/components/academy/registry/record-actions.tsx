"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteRegistryRecord, retireRegistryRecord } from "@/app/(app)/academy/registry/actions";
import type { RegistryKind, RegistryUsage } from "./types";

/**
 * Row actions of a registry record: edit dialog (passed in) + delete.
 * A record that is still referenced cannot be deleted — the dialog explains why and offers archiving / closing instead.
 */
export function RecordActions({
  kind, id, name, retired, usage, editor,
}: {
  kind: RegistryKind;
  id: string;
  name: string;
  /** already ARCHIVED (faculty, partner) / CLOSED (lab) */
  retired: boolean;
  usage: RegistryUsage;
  editor: React.ReactNode;
}) {
  const t = useTranslations("registry");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const used = Object.entries(usage).filter(([, n]) => (n ?? 0) > 0) as [keyof RegistryUsage, number][];
  const inUse = used.length > 0;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(t((res.message ?? "toast.updated") as never), { description: name });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      {editor}
      <Button
        size="icon-lg"
        variant="ghost"
        className="text-muted-foreground hover:text-danger"
        aria-label={t("actions.deleteLabel", { name })}
        title={t("actions.delete")}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{inUse ? t("delete.inUseTitle", { name }) : t("delete.title", { name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {inUse ? t(`delete.inUseBody.${kind}`) : t("delete.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {inUse && (
            <div className="grid gap-2 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">{t("delete.usedBy")}</p>
              <ul className="flex flex-wrap gap-1.5">
                {used.map(([k, n]) => (
                  <li key={k} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular">{t(`usage.${k}`, { count: n })}</li>
                ))}
              </ul>
              {retired && <p className="text-xs text-muted-foreground">{t(`delete.alreadyRetired.${kind}`)}</p>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{inUse ? tc("close") : tc("cancel")}</AlertDialogCancel>
            {inUse ? (
              !retired && (
                <AlertDialogAction onClick={() => run(() => retireRegistryRecord(kind, id))} disabled={pending} aria-busy={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                  {t(`delete.retire.${kind}`)}
                </AlertDialogAction>
              )
            ) : (
              <AlertDialogAction variant="destructive" onClick={() => run(() => deleteRegistryRecord(kind, id))} disabled={pending} aria-busy={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                {tc("delete")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
