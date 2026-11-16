"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { saveResourceRequest } from "@/app/(app)/projects/[id]/resources/actions";
import type { ResourceFormValue, ResourceOption } from "./types";

type Props = {
  projectId: string;
  labs: ResourceOption[];
  partners: ResourceOption[];
  /** today in program timezone (YYYY-MM-DD) — earliest selectable needed-by date */
  minDate: string;
  request?: ResourceFormValue;
};

/** Create (no `request`) or edit (own request while NEW) dialog. */
export function ResourceFormDialog(props: Props) {
  const t = useTranslations("resources");
  const [open, setOpen] = useState(false);
  const { request } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {request ? (
        <DialogTrigger
          render={<Button size="icon-lg" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={t("form.editLabel", { title: request.title })} />}
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
          <DialogTitle>{request ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.dialogDescription")}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form (and its errors) starts fresh on every open */}
        <ResourceForm {...props} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ResourceForm({ projectId, labs, partners, minDate, request, close }: Props & { close: () => void }) {
  const t = useTranslations("resources");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;

  const { pending, onSubmit, error } = useFormAction(saveResourceRequest, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.updated") as never));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.invalid") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  const described = (k: string, hasHint = true) => (err(k) ? `${id(k)}-error` : hasHint ? `${id(k)}-hint` : undefined);

  // keep a meanwhile closed lab / archived partner selectable when it is the saved value
  const labOptions = request?.labId && !labs.some((l) => l.value === request.labId) ? [{ value: request.labId, label: request.labLabel ?? request.labId }, ...labs] : labs;
  const partnerOptions =
    request?.partnerId && !partners.some((p) => p.value === request.partnerId) ? [{ value: request.partnerId, label: request.partnerLabel ?? request.partnerId }, ...partners] : partners;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      {request && <input type="hidden" name="requestId" value={request.id} />}
      <Field label={t("form.title")} htmlFor={id("title")} required hint={t("form.titleHint")} error={err("title")}>
        <Input
          id={id("title")} name="title" defaultValue={request?.title} required minLength={3} maxLength={160}
          aria-invalid={!!err("title")} aria-describedby={described("title")}
        />
      </Field>
      <Field label={t("form.details")} htmlFor={id("details")} hint={t("form.detailsHint")} error={err("details")}>
        <Textarea
          id={id("details")} name="details" defaultValue={request?.details} rows={3} maxLength={2000}
          aria-invalid={!!err("details")} aria-describedby={described("details")}
        />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.lab")} htmlFor={id("labId")} hint={t("form.labHint")} error={err("labId")}>
          <NativeSelect id={id("labId")} name="labId" defaultValue={request?.labId ?? ""} aria-invalid={!!err("labId")} aria-describedby={described("labId")}>
            <option value="">{t("form.none")}</option>
            {labOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("form.partner")} htmlFor={id("partnerId")} hint={t("form.partnerHint")} error={err("partnerId")}>
          <NativeSelect id={id("partnerId")} name="partnerId" defaultValue={request?.partnerId ?? ""} aria-invalid={!!err("partnerId")} aria-describedby={described("partnerId")}>
            <option value="">{t("form.none")}</option>
            {partnerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("form.neededBy")} htmlFor={id("neededBy")} hint={t("form.neededByHint")} error={err("neededBy")}>
          <Input
            id={id("neededBy")} name="neededBy" type="date" defaultValue={request?.neededBy ?? ""} min={request?.neededBy && request.neededBy < minDate ? undefined : minDate}
            aria-invalid={!!err("neededBy")} aria-describedby={described("neededBy")}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{request ? t("form.submitEdit") : t("form.submitCreate")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
