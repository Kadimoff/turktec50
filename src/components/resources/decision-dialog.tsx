"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { ToneBadge } from "@/components/shared/tone-badge";
import { resourceTone } from "@/lib/tones";
import { decideResourceRequest } from "@/app/(app)/projects/[id]/resources/actions";
import { DECISION_FLOW, NOTE_MAX, NOTE_MIN, NOTE_REQUIRED, type ResourceStatusKey } from "./types";

type Props = {
  projectId: string;
  requestId: string;
  title: string;
  status: ResourceStatusKey;
  /** server-rendered <HumanControlNote /> */
  humanNote?: React.ReactNode;
};

/** Coordinator records a human decision on a resource request (status + note). */
export function DecisionDialog(props: Props) {
  const t = useTranslations("resources");
  const [open, setOpen] = useState(false);
  if (DECISION_FLOW[props.status].length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" aria-label={t("decide.buttonLabel", { title: props.title })} />}>
        <ClipboardCheck aria-hidden />
        {t("decide.button")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("decide.title")}</DialogTitle>
          <DialogDescription>{t("decide.description")}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so status, note and errors start fresh on every open */}
        <DecisionForm {...props} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({ projectId, requestId, title, status, humanNote, close }: Props & { close: () => void }) {
  const t = useTranslations("resources");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const [next, setNext] = useState<ResourceStatusKey | "">("");
  const [note, setNote] = useState("");
  const options = DECISION_FLOW[status];

  const { pending, onSubmit, error } = useFormAction(decideResourceRequest, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.decided") as never));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.invalid") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  const noteRequired = next !== "" && NOTE_REQUIRED.includes(next);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
        <p className="text-sm font-medium text-pretty">{title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("decide.current")}
          <ToneBadge tone={resourceTone[status]}>{te(`ResourceStatus.${status}`)}</ToneBadge>
        </p>
      </div>
      <Field label={t("decide.status")} htmlFor={id("status")} required error={err("status")}>
        <NativeSelect
          id={id("status")} name="status" required value={next}
          onChange={(e) => setNext(e.target.value as ResourceStatusKey)}
          aria-invalid={!!err("status")} aria-describedby={err("status") ? `${id("status")}-error` : undefined}
        >
          <option value="" disabled>{t("decide.choose")}</option>
          {options.map((s) => <option key={s} value={s}>{te(`ResourceStatus.${s}`)}</option>)}
        </NativeSelect>
      </Field>
      <Field
        label={t("decide.note")}
        htmlFor={id("note")}
        required={noteRequired}
        hint={noteRequired ? t("decide.noteHintRequired", { min: NOTE_MIN, max: NOTE_MAX }) : t("decide.noteHintOptional")}
        error={err("note")}
      >
        <Textarea
          id={id("note")} name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          required={noteRequired} minLength={noteRequired ? NOTE_MIN : undefined} maxLength={NOTE_MAX}
          aria-invalid={!!err("note")} aria-describedby={err("note") ? `${id("note")}-error` : `${id("note")}-hint`}
        />
      </Field>
      <p className="-mt-2 text-right text-xs text-muted-foreground tabular">
        {t("decide.count", { count: note.trim().length, max: NOTE_MAX })}
      </p>
      {humanNote}
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("decide.pending")}>{t("decide.submit")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
