"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { addChecklistItem } from "@/app/(app)/projects/[id]/documents/actions";
import { initialActionState, type ActionState } from "./types";

export function AddItemDialog({ projectId }: { projectId: string }) {
  const t = useTranslations("documents");
  const te = useTranslations("enums.ChecklistCategory");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const [open, setOpen] = useState(false);

  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await addChecklistItem(prev, fd);
    if (res.ok) {
      toast.success(t("toast.itemAdded"));
      setOpen(false);
    } else {
      toast.error(t((res.message ?? "errors.generic") as never));
    }
    return res;
  }, initialActionState);

  const titleError = !state.ok && state.errors?.title ? t(state.errors.title as never) : undefined;
  const id = (s: string) => `${uid}-${s}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-9" />}>
        <Plus aria-hidden />
        {t("add.button")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label={t("add.itemTitle")} htmlFor={id("title")} required hint={t("add.itemTitleHint")} error={titleError}>
            <Input
              id={id("title")}
              name="title"
              required
              minLength={3}
              maxLength={140}
              className="h-9"
              aria-invalid={!!titleError}
              aria-describedby={titleError ? `${id("title")}-error` : `${id("title")}-hint`}
            />
          </Field>
          <Field label={t("add.category")} htmlFor={id("category")} required>
            <NativeSelect id={id("category")} name="category" defaultValue="ANNEX">
              {(["CORE", "ANNEX", "CONDITIONAL"] as const).map((c) => (
                <option key={c} value={c}>
                  {te(c)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2.5 text-[13px] font-medium">
            <input type="checkbox" name="required" defaultChecked className="size-4 accent-primary" />
            {t("add.required")}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={t("add.pending")}>{t("add.submit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
