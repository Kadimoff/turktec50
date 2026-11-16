"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { describedBy } from "@/components/academy/registry/form-bits";
import { deleteTraining, saveTraining } from "@/app/(app)/academy/trainings/actions";
import { TRAINING_STATUSES, type Option, type TrainingValue } from "./types";

/** Keep the current (possibly inactive / closed) value selectable when editing. */
function withCurrent(list: Option[], current: Option | null | undefined) {
  return current && !list.some((o) => o.id === current.id) ? [current, ...list] : list;
}

export function TrainingDialog({ training, mentors, labs, defaultDate }: { training?: TrainingValue; mentors: Option[]; labs: Option[]; defaultDate: string }) {
  const t = useTranslations("trainings");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {training ? (
        <DialogTrigger
          render={<Button size="icon-lg" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={t("actions.editLabel", { title: training.title })} title={t("actions.edit")} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          {t("form.create")}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{training ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        <TrainingForm training={training} mentors={withCurrent(mentors, training?.mentor)} labs={withCurrent(labs, training?.lab)} defaultDate={defaultDate} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TrainingForm({ training, mentors, labs, defaultDate, close }: { training?: TrainingValue; mentors: Option[]; labs: Option[]; defaultDate: string; close: () => void }) {
  const t = useTranslations("trainings");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const f = (s: string) => `${uid}-${s}`;
  const { pending, onSubmit, error } = useFormAction(saveTraining, {
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

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {training && <input type="hidden" name="id" value={training.id} />}
      <Field label={t("form.title")} htmlFor={f("title")} required error={err("title")}>
        <Input id={f("title")} name="title" defaultValue={training?.title} required minLength={3} maxLength={160} autoComplete="off" aria-invalid={!!err("title")} aria-describedby={describedBy(f("title"), err("title"))} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-3">
        <Field label={t("form.date")} htmlFor={f("date")} required error={err("date")}>
          <Input id={f("date")} name="date" type="date" defaultValue={training?.date ?? defaultDate} required aria-invalid={!!err("date")} aria-describedby={describedBy(f("date"), err("date"))} />
        </Field>
        <Field label={t("form.time")} htmlFor={f("time")} required hint={t("form.timeHint")} error={err("time")}>
          <Input id={f("time")} name="time" type="time" defaultValue={training?.time ?? "14:00"} required aria-invalid={!!err("time")} aria-describedby={describedBy(f("time"), err("time"), true)} />
        </Field>
        <Field label={t("form.duration")} htmlFor={f("dur")} required hint={t("form.durationHint")} error={err("durationMin")}>
          <Input id={f("dur")} name="durationMin" type="number" inputMode="numeric" min={15} max={600} step={5} defaultValue={training?.durationMin ?? 90} required className="tabular" aria-invalid={!!err("durationMin")} aria-describedby={describedBy(f("dur"), err("durationMin"), true)} />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.mentor")} htmlFor={f("mentor")} hint={t("form.mentorHint")} error={err("mentorId")}>
          <NativeSelect id={f("mentor")} name="mentorId" defaultValue={training?.mentor?.id ?? ""} aria-invalid={!!err("mentorId")} aria-describedby={describedBy(f("mentor"), err("mentorId"), true)}>
            <option value="">{t("form.noMentor")}</option>
            {mentors.map((m) => <option key={m.id} value={m.id}>{m.hint ? `${m.name} · ${m.hint}` : m.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("form.lab")} htmlFor={f("lab")} hint={t("form.labHint")} error={err("labId")}>
          <NativeSelect id={f("lab")} name="labId" defaultValue={training?.lab?.id ?? ""} aria-invalid={!!err("labId")} aria-describedby={describedBy(f("lab"), err("labId"), true)}>
            <option value="">{t("form.noLab")}</option>
            {labs.map((l) => <option key={l.id} value={l.id}>{l.hint ? `${l.name} · ${l.hint}` : l.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("form.status")} htmlFor={f("status")} required error={err("status")}>
          <NativeSelect id={f("status")} name="status" defaultValue={training?.status ?? "PLANNED"} aria-invalid={!!err("status")}>
            {TRAINING_STATUSES.map((s) => <option key={s} value={s}>{te(`TrainingStatus.${s}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("form.notes")} htmlFor={f("notes")} hint={t("form.notesHint")} error={err("notes")}>
        <Textarea id={f("notes")} name="notes" defaultValue={training?.notes ?? ""} rows={3} maxLength={2000} aria-invalid={!!err("notes")} aria-describedby={describedBy(f("notes"), err("notes"), true)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close} disabled={pending}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{training ? tc("save") : tc("create")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function DeleteTrainingButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations("trainings");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const res = await deleteTraining(id);
      if (res.ok) {
        toast.success(t((res.message ?? "toast.deleted") as never), { description: title });
        setOpen(false);
      } else {
        toast.error(t((res.message ?? "errors.generic") as never));
      }
    });
  }

  return (
    <>
      <Button size="icon-lg" variant="ghost" className="text-muted-foreground hover:text-danger" aria-label={t("actions.deleteLabel", { title })} title={t("actions.delete")} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title", { title })}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={pending} aria-busy={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
