"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Send, Trash2, Undo2 } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { describedBy } from "@/components/academy/registry/form-bits";
import { cn } from "@/lib/utils";
import { deleteAnnouncement, publishAnnouncement, saveAnnouncement, unpublishAnnouncement } from "@/app/(app)/announcements/actions";
import { BODY_MAX, ROLES, TITLE_MAX, type AnnouncementValue } from "./types";

export function AnnouncementDialog({ announcement }: { announcement?: AnnouncementValue }) {
  const t = useTranslations("announcements");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {announcement ? (
        <DialogTrigger render={<Button size="lg" variant="ghost" aria-label={t("actions.editLabel", { title: announcement.title })} />}>
          <Pencil aria-hidden />
          {t("actions.edit")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          {t("form.create")}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{announcement ? t("form.editDescription") : t("form.createDescription")}</DialogDescription>
        </DialogHeader>
        <AnnouncementForm announcement={announcement} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementForm({ announcement, close }: { announcement?: AnnouncementValue; close: () => void }) {
  const t = useTranslations("announcements");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const f = (s: string) => `${uid}-${s}`;
  const [audience, setAudience] = useState<Role[]>(announcement?.audience ?? ["TEAM", "MENTOR"]);
  const [body, setBody] = useState(announcement?.body ?? "");
  const { pending, onSubmit, error } = useFormAction(saveAnnouncement, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.updated") as never));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  const toggle = (r: Role, on: boolean) => setAudience((a) => (on ? [...a.filter((x) => x !== r), r] : a.filter((x) => x !== r)));
  const audienceErr = err("audience") ?? (audience.length === 0 ? t("errors.audience") : undefined);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {announcement && <input type="hidden" name="id" value={announcement.id} />}
      {ROLES.filter((r) => audience.includes(r)).map((r) => <input key={r} type="hidden" name="audience" value={r} />)}
      <Field label={t("form.title")} htmlFor={f("title")} required error={err("title")}>
        <Input id={f("title")} name="title" defaultValue={announcement?.title} required minLength={3} maxLength={TITLE_MAX} autoComplete="off" aria-invalid={!!err("title")} aria-describedby={describedBy(f("title"), err("title"))} />
      </Field>
      <Field label={t("form.body")} htmlFor={f("body")} required hint={t("form.bodyHint")} error={err("body")}>
        <Textarea
          id={f("body")} name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={7} maxLength={BODY_MAX}
          aria-invalid={!!err("body")} aria-describedby={`${describedBy(f("body"), err("body"), true)} ${f("count")}`}
        />
      </Field>
      <p id={f("count")} className="-mt-3 text-right text-xs text-muted-foreground tabular" aria-live="polite">{t("form.counter", { count: body.length, max: BODY_MAX })}</p>
      <fieldset className="grid gap-2" aria-describedby={audienceErr ? f("aud-error") : f("aud-hint")} aria-invalid={!!audienceErr}>
        <legend className="mb-1.5 text-label font-medium">
          {t("form.audience")}
          <span className="text-danger" aria-hidden> *</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => {
            const on = audience.includes(r);
            return (
              <label key={r} className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted/50", on && "border-primary/50 bg-primary/5")}>
                <Checkbox checked={on} onCheckedChange={(v) => toggle(r, v === true)} />
                <span>{te(`Role.${r}`)}</span>
              </label>
            );
          })}
        </div>
        {audienceErr ? (
          <p id={f("aud-error")} className="text-xs font-medium text-danger" role="alert">{audienceErr}</p>
        ) : (
          <p id={f("aud-hint")} className="text-xs text-muted-foreground">{t("form.audienceHint")}</p>
        )}
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close} disabled={pending}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{announcement ? tc("save") : t("form.saveDraft")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

type Confirm = "publish" | "unpublish" | "delete";

/** Publish / back to draft / delete — each confirmed in an AlertDialog. */
export function AnnouncementActions({ id, title, published, recipients }: { id: string; title: string; published: boolean; recipients: number }) {
  const t = useTranslations("announcements");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  // kept after closing so the dialog text does not change during the exit animation
  const [kind, setKind] = useState<Confirm>("publish");
  const [pending, start] = useTransition();
  const ask = (k: Confirm) => { setKind(k); setOpen(true); };

  function run() {
    start(async () => {
      const res = kind === "publish" ? await publishAnnouncement(id) : kind === "unpublish" ? await unpublishAnnouncement(id) : await deleteAnnouncement(id);
      if (res.ok) {
        toast.success(t((res.message ?? "toast.updated") as never), { description: title });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
      }
    });
  }

  return (
    <>
      {published ? (
        <Button size="lg" variant="ghost" onClick={() => ask("unpublish")} aria-label={t("actions.unpublishLabel", { title })}>
          <Undo2 aria-hidden />
          {t("actions.unpublish")}
        </Button>
      ) : (
        <Button size="lg" onClick={() => ask("publish")} aria-label={t("actions.publishLabel", { title })}>
          <Send aria-hidden />
          {t("actions.publish")}
        </Button>
      )}
      <Button size="icon-lg" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={() => ask("delete")} aria-label={t("actions.deleteLabel", { title })} title={t("actions.delete")}>
        <Trash2 aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`confirm.${kind}Title`, { title })}</AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "publish" ? t("confirm.publishBody", { count: recipients }) : t(`confirm.${kind}Body`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant={kind === "delete" ? "destructive" : "default"} onClick={run} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {kind === "publish" ? t("actions.publish") : kind === "unpublish" ? t("actions.unpublish") : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
