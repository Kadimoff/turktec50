"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, SubmitButton } from "@/components/shared/form";
import { decideApplication, createWorkspaceFromApplication, type DecisionState } from "@/app/(app)/applications/actions";
import { cn } from "@/lib/utils";

const DECISIONS = ["ACCEPTED", "WAITLIST", "REJECTED"] as const;
const decisionStyle: Record<(typeof DECISIONS)[number], string> = {
  ACCEPTED: "peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success",
  WAITLIST: "peer-checked:border-warning peer-checked:bg-warning-soft peer-checked:text-warning",
  REJECTED: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger",
};

/** Coordinator-only: record a human decision with rationale. */
export function DecisionForm({ applicationId, current, note }: { applicationId: string; current: string; note: string | null }) {
  const t = useTranslations("applications.decision");
  const te = useTranslations("enums.ApplicationStatus");
  const [state, action] = useActionState<DecisionState, FormData>(decideApplication, undefined);
  const [choice, setChoice] = useState<string>((DECISIONS as readonly string[]).includes(current) ? current : "");

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(t("toast"));
    else toast.error(t(`errors.${state.error}`));
  }, [state, t]);

  const noteError = state && !state.ok && state.error === "noteRequired" ? t("errors.noteRequired") : undefined;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">
          {t("choose")}
          <span className="text-danger" aria-hidden> *</span>
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {DECISIONS.map((d) => (
            <div key={d} className="relative">
              <input
                type="radio"
                id={`decision-${d}`}
                name="status"
                value={d}
                required
                checked={choice === d}
                onChange={() => setChoice(d)}
                className="peer sr-only"
              />
              <label
                htmlFor={`decision-${d}`}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-center rounded-lg border bg-background px-2 text-sm font-medium transition-colors duration-150 hover:bg-muted",
                  "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  decisionStyle[d],
                )}
              >
                {te(d)}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <Field label={t("note")} htmlFor="decision-note" required hint={t("noteHint")} error={noteError}>
        <Textarea
          id="decision-note"
          name="note"
          required
          minLength={10}
          maxLength={1000}
          rows={3}
          defaultValue={note ?? ""}
          aria-invalid={!!noteError}
          aria-describedby={noteError ? "decision-note-error" : "decision-note-hint"}
        />
      </Field>
      <SubmitButton className="h-10 w-full" pendingLabel={t("saving")}>
        {t("record")}
      </SubmitButton>
    </form>
  );
}

/** Coordinator-only: turn an accepted application into a project workspace. */
export function CreateWorkspaceButton({ applicationId, contactEmail }: { applicationId: string; contactEmail: string }) {
  const t = useTranslations("applications.workspace");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button className="h-10 w-full" disabled={pending} />}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FolderPlus aria-hidden />}
        {t("create")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmBody", { email: contactEmail })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await createWorkspaceFromApplication(applicationId);
                setOpen(false);
                if (res.ok) {
                  toast.success(t("toast", { code: res.code }), { description: res.newUser ? t("toastUser", { email: contactEmail }) : undefined });
                  router.push(`/projects/${res.projectId}`);
                } else toast.error(t(`errors.${res.error}`));
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
