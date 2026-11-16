"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Eye, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { reviewChecklistItem } from "@/app/(app)/projects/[id]/documents/actions";

type Decision = "APPROVED" | "REJECTED";

export function ReviewActions({
  projectId,
  itemId,
  itemLabel,
  latestVersion,
  status,
}: {
  projectId: string;
  itemId: string;
  itemLabel: string;
  latestVersion: number;
  status: string;
}) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  const [startPending, startTransition] = useTransition();

  function markInReview() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("itemId", itemId);
      fd.set("decision", "IN_REVIEW");
      const res = await reviewChecklistItem(initialActionState, fd);
      if (res.ok) toast.success(t("toast.inReview"));
      else toast.error(t((res.message ?? "errors.generic") as never));
    });
  }

  return (
    <>
      {status === "UPLOADED" && (
        <Button size="lg" variant="ghost" onClick={markInReview} disabled={startPending} aria-busy={startPending}>
          {startPending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          {t("review.start")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="lg" variant="secondary" />}>
          <ClipboardCheck aria-hidden />
          {t("review.button")}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("review.title")}</DialogTitle>
            <DialogDescription>{t("review.description", { item: itemLabel, n: latestVersion })}</DialogDescription>
          </DialogHeader>
          {/* the popup unmounts when closed, so the form starts fresh on every open */}
          <ReviewForm projectId={projectId} itemId={itemId} status={status} close={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewForm({ projectId, itemId, status, close }: { projectId: string; itemId: string; status: string; close: () => void }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const [decision, setDecision] = useState<Decision>(status === "REJECTED" ? "REJECTED" : "APPROVED");
  const { pending, onSubmit, error } = useFormAction(reviewChecklistItem, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.approved") as never));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });

  const noteId = `${uid}-note`;
  const noteError = error("note") ? t(error("note") as never) : undefined;
  const options: { value: Decision; label: string; hint: string; icon: typeof CheckCircle2; tone: string }[] = [
    { value: "APPROVED", label: t("review.approve"), hint: t("review.approveHint"), icon: CheckCircle2, tone: "text-success" },
    { value: "REJECTED", label: t("review.reject"), hint: t("review.rejectHint"), icon: RotateCcw, tone: "text-danger" },
  ];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="itemId" value={itemId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-label font-medium">{t("review.decision")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors hover:bg-muted/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                decision === o.value && "border-primary bg-accent/60",
              )}
            >
              <input
                type="radio"
                name="decision"
                value={o.value}
                checked={decision === o.value}
                onChange={() => setDecision(o.value)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="grid gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <o.icon className={cn("size-4", o.tone)} aria-hidden />
                  {o.label}
                </span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("review.note")} htmlFor={noteId} required={decision === "REJECTED"} hint={t("review.noteHint")} error={noteError}>
        <Textarea
          id={noteId}
          name="note"
          rows={3}
          maxLength={1000}
          required={decision === "REJECTED"}
          aria-invalid={!!noteError}
          aria-describedby={noteError ? `${noteId}-error` : `${noteId}-hint`}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>
          {tc("cancel")}
        </Button>
        <SubmitButton pending={pending} pendingLabel={t("review.pending")}>{t("review.submit")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
