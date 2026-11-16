"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { saveTracking } from "@/app/(app)/academy/catalog/actions";
import { RULE_STATUSES } from "./helpers";
import type { OwnerOption, TrackingFormValue } from "./types";

/** ADMIN: start / edit 2027 rule tracking for one catalog card. */
export function TrackingDialog({ value, owners, currentUserId, today }: { value: TrackingFormValue; owners: OwnerOption[]; currentUserId: string; today: string }) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const editing = value.status !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="lg" aria-label={t(editing ? "form.editLabel" : "form.startLabel", { name: value.name })} />}
      >
        {editing ? <Pencil aria-hidden /> : <Eye aria-hidden />}
        {editing ? t("form.edit") : t("form.start")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.editTitle") : t("form.startTitle")}</DialogTitle>
          <DialogDescription className="break-words">{value.name}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so errors and field values start fresh on every open */}
        <TrackingForm value={value} owners={owners} currentUserId={currentUserId} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TrackingForm({
  value,
  owners,
  currentUserId,
  today,
  onDone,
}: {
  value: TrackingFormValue;
  owners: OwnerOption[];
  currentUserId: string;
  today: string;
  onDone: () => void;
}) {
  const t = useTranslations("catalog");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const editing = value.status !== null;
  const [status, setStatus] = useState<string>(value.status ?? "TRACKING");

  const { pending, onSubmit, error } = useFormAction(saveTracking, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.updated") as never), { description: value.name });
      onDone();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  const describedBy = (k: string) => `${id(k)}-${err(k) ? "error" : "hint"}`;

  const ownerList: OwnerOption[] = [...owners];
  if (value.ownerId && value.ownerName && !ownerList.some((o) => o.id === value.ownerId)) {
    ownerList.unshift({ id: value.ownerId, name: value.ownerActive ? value.ownerName : t("form.ownerInactive", { name: value.ownerName }) });
  }
  const defaultOwner = value.ownerId ?? (owners.some((o) => o.id === currentUserId) ? currentUserId : "");
  const confirmed = status === "CONFIRMED";

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="competitionId" value={value.id} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.status")} htmlFor={id("status")} required hint={t(`form.statusHint.${status}` as never)} error={err("status")}>
          <NativeSelect
            id={id("status")}
            name="status"
            defaultValue={value.status ?? "TRACKING"}
            onChange={(e) => setStatus(e.target.value)}
            aria-invalid={!!err("status")}
            aria-describedby={describedBy("status")}
          >
            {RULE_STATUSES.map((s) => (
              <option key={s} value={s}>{te(`RuleStatus.${s}`)}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("form.owner")} htmlFor={id("ownerId")} required hint={t("form.ownerHint")} error={err("ownerId")}>
          <NativeSelect
            id={id("ownerId")}
            name="ownerId"
            defaultValue={defaultOwner}
            required
            aria-invalid={!!err("ownerId")}
            aria-describedby={describedBy("ownerId")}
          >
            <option value="" disabled>{t("form.ownerChoose")}</option>
            {ownerList.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field
        label={t("form.sourceUrl")}
        htmlFor={id("sourceUrl")}
        required={confirmed}
        hint={confirmed ? t("form.sourceRequiredHint") : t("form.sourceHint")}
        error={err("sourceUrl")}
      >
        <Input
          id={id("sourceUrl")}
          name="sourceUrl"
          type="url"
          inputMode="url"
          defaultValue={value.sourceUrl}
          placeholder="https://"
          maxLength={2000}
          required={confirmed}
          aria-invalid={!!err("sourceUrl")}
          aria-describedby={describedBy("sourceUrl")}
        />
      </Field>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.deadline")} htmlFor={id("deadline")} hint={t("form.deadlineHint")} error={err("deadline")}>
          <Input
            id={id("deadline")}
            name="deadline"
            type="date"
            defaultValue={value.deadline}
            aria-invalid={!!err("deadline")}
            aria-describedby={describedBy("deadline")}
          />
        </Field>
        <Field label={t("form.finalDate")} htmlFor={id("finalDate")} hint={t("form.finalHint")} error={err("finalDate")}>
          <Input
            id={id("finalDate")}
            name="finalDate"
            type="date"
            defaultValue={value.finalDate}
            aria-invalid={!!err("finalDate")}
            aria-describedby={describedBy("finalDate")}
          />
        </Field>
        <Field label={t("form.checkedAt")} htmlFor={id("checkedAt")} hint={t("form.checkedHint")} error={err("checkedAt")}>
          <Input
            id={id("checkedAt")}
            name="checkedAt"
            type="date"
            defaultValue={value.checkedAt || (editing ? "" : today)}
            max={today}
            aria-invalid={!!err("checkedAt")}
            aria-describedby={describedBy("checkedAt")}
          />
        </Field>
      </div>

      <Field label={t("form.notes")} htmlFor={id("notes")} hint={t("form.notesHint")} error={err("notes")}>
        <Textarea
          id={id("notes")}
          name="notes"
          defaultValue={value.notes}
          rows={3}
          maxLength={2000}
          aria-invalid={!!err("notes")}
          aria-describedby={describedBy("notes")}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{editing ? t("form.submitEdit") : t("form.submitStart")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
