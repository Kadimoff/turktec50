"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, FolderKanban, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { TempPasswordBox } from "@/components/account/temp-password";
import { decideApplication, createWorkspaceFromApplication } from "@/app/(app)/applications/actions";
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
  const [choice, setChoice] = useState<string>((DECISIONS as readonly string[]).includes(current) ? current : "");
  const { pending, onSubmit, error } = useFormAction(decideApplication, {
    onDone: () => toast.success(t("toast")),
    onFail: (s) => toast.error(t((s.message ?? "errors.invalid") as never)),
  });
  const noteError = error("note") ? t(error("note") as never) : undefined;
  const statusError = error("status") ? t(error("status") as never) : undefined;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset aria-describedby={statusError ? "decision-status-error" : undefined}>
        <legend className="mb-2 text-label font-medium">
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
                  "flex h-9 cursor-pointer items-center justify-center rounded-lg border bg-background px-2 text-sm font-medium transition-colors duration-150 hover:bg-muted",
                  "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  decisionStyle[d],
                )}
              >
                {te(d)}
              </label>
            </div>
          ))}
        </div>
        {statusError && <p id="decision-status-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">{statusError}</p>}
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
      <SubmitButton pending={pending} className="w-full" pendingLabel={t("saving")}>
        {t("record")}
      </SubmitButton>
    </form>
  );
}

type Created = { projectId: string; code: string; email: string; tempPassword: string };

/**
 * Coordinator-only workspace block: "create workspace" for an accepted application, or the link to its project.
 * The page keeps this component at the same tree position before and after creation, so the one-time password dialog survives the
 * refresh that follows the action (a new lead account gets a temporary password, shown once).
 */
export function WorkspacePanel({ applicationId, contactEmail, project }: { applicationId: string; contactEmail: string; project: { id: string; code: string } | null }) {
  const t = useTranslations("applications.workspace");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  function create() {
    startTransition(async () => {
      const res = await createWorkspaceFromApplication(applicationId);
      setOpen(false);
      if (!res.ok || !res.projectId || !res.code) {
        toast.error(t((res.message ?? "errors.error") as never));
        return;
      }
      toast.success(t("toast", { code: res.code }));
      if (res.tempPassword) setCreated({ projectId: res.projectId, code: res.code, email: res.email ?? contactEmail, tempPassword: res.tempPassword });
      else router.push(`/projects/${res.projectId}`);
    });
  }

  return (
    <>
      {project ? (
        <Button variant="outline" size="lg" className="w-full" nativeButton={false} render={<Link href={`/projects/${project.id}`} />}>
          <FolderKanban aria-hidden />
          {t("open", { code: project.code })}
          <ArrowRight aria-hidden />
        </Button>
      ) : (
        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
            <AlertDialogTrigger render={<Button size="lg" className="w-full" disabled={pending} />}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FolderPlus aria-hidden />}
              {t("create")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmBody", { email: contactEmail })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction disabled={pending} aria-busy={pending} onClick={create}>
                  {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {t("confirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* the temporary password lives only in this component's state: closing the dialog discards it */}
      <Dialog open={!!created} onOpenChange={(o) => { if (!o) setCreated(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {created && (
            <>
              <DialogHeader>
                <DialogTitle>{t("createdTitle", { code: created.code })}</DialogTitle>
                <DialogDescription>{t("createdBody", { email: created.email })}</DialogDescription>
              </DialogHeader>
              <TempPasswordBox password={created.tempPassword} email={created.email} />
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => setCreated(null)}>{tc("close")}</Button>
                <Button size="lg" nativeButton={false} render={<Link href={`/projects/${created.projectId}`} />}>
                  {t("open", { code: created.code })}
                  <ArrowRight aria-hidden />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
