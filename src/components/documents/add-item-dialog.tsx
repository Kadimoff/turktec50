"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { addChecklistItem } from "@/app/(app)/projects/[id]/documents/actions";

export function AddItemDialog({ projectId }: { projectId: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <Plus aria-hidden />
        {t("add.button")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form starts fresh on every open */}
        <AddItemForm projectId={projectId} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddItemForm({ projectId, close }: { projectId: string; close: () => void }) {
  const t = useTranslations("documents");
  const te = useTranslations("enums.ChecklistCategory");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const { pending, onSubmit, error } = useFormAction(addChecklistItem, {
    onDone: () => {
      toast.success(t("toast.itemAdded"));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t("add.itemTitle")} htmlFor={id("title")} required hint={t("add.itemTitleHint")} error={err("title")}>
        <Input
          id={id("title")}
          name="title"
          required
          minLength={3}
          maxLength={140}
          aria-invalid={!!err("title")}
          aria-describedby={err("title") ? `${id("title")}-error` : `${id("title")}-hint`}
        />
      </Field>
      <Field label={t("add.category")} htmlFor={id("category")} required error={err("category")}>
        <NativeSelect id={id("category")} name="category" defaultValue="ANNEX" aria-invalid={!!err("category")}>
          {(["CORE", "ANNEX", "CONDITIONAL"] as const).map((c) => (
            <option key={c} value={c}>
              {te(c)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center gap-2.5 text-label font-medium">
        <input type="checkbox" name="required" defaultChecked className="size-4 accent-primary" />
        {t("add.required")}
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>
          {tc("cancel")}
        </Button>
        <SubmitButton pending={pending} pendingLabel={t("add.pending")}>{t("add.submit")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
