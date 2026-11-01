"use client";
import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Info, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field } from "@/components/shared/form";
import { ToneBadge } from "@/components/shared/tone-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { saveSelectionEvaluation, type EvalState } from "@/app/(app)/applications/actions";
import { cn } from "@/lib/utils";

type Criterion = { id: string; key: string; weight: number; maxScore: number };

function preview(criteria: Criterion[], scores: Record<string, number>) {
  let total = 0;
  for (const c of criteria) if (typeof scores[c.id] === "number") total += (scores[c.id]! / c.maxScore) * c.weight;
  return Math.round(total * 10) / 10;
}

export function SelectionRubricForm({
  applicationId,
  criteria,
  initial,
  submittedAtLabel,
}: {
  applicationId: string;
  criteria: Criterion[];
  initial: { scores: Record<string, number>; comment: string; status: "DRAFT" | "SUBMITTED" | null };
  submittedAtLabel?: string;
}) {
  const t = useTranslations("applications.rubric");
  const tj = useTranslations("jury");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<EvalState, FormData>(saveSelectionEvaluation, undefined);
  const [scores, setScores] = useState<Record<string, number>>(initial.scores);
  const [missing, setMissing] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastIntent, setLastIntent] = useState<"draft" | "submit">("draft");
  const formRef = useRef<HTMLFormElement>(null);
  const locked = initial.status === "SUBMITTED";

  const score = useMemo(() => preview(criteria, scores), [criteria, scores]);
  const scoredCount = criteria.filter((c) => typeof scores[c.id] === "number").length;
  const serverMissing = state && !state.ok && state.error === "incomplete" ? (state.missing ?? []) : [];
  const shownMissing = [...new Set([...missing, ...serverMissing])].filter((id) => typeof scores[id] !== "number");

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.intent === "submit" ? t("toastSubmitted") : t("toastDraft"));
    else toast.error(t(`errors.${state.error}`));
  }, [state, t]);

  function run(intent: "draft" | "submit") {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("intent", intent);
    setLastIntent(intent);
    startTransition(() => formAction(fd));
  }

  function requestSubmit() {
    const miss = criteria.filter((c) => typeof scores[c.id] !== "number").map((c) => c.id);
    setMissing(miss);
    if (miss.length) {
      document.getElementById(`crit-${miss[0]}`)?.focus();
      toast.error(t("errors.incomplete"));
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        run("draft");
      }}
      className="space-y-5"
      noValidate
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      {locked && (
        <p className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("lockedNote", { date: submittedAtLabel ?? "—" })}</span>
        </p>
      )}

      <div className="space-y-4">
        {criteria.map((c) => {
          const err = shownMissing.includes(c.id);
          return (
            <fieldset
              key={c.id}
              id={`crit-${c.id}`}
              tabIndex={-1}
              aria-describedby={`crit-${c.id}-hint${err ? ` crit-${c.id}-error` : ""}`}
              className={cn("min-w-0 rounded-lg border p-2.5 outline-none sm:p-4", err && "border-danger/60 bg-danger-soft/30")}
              disabled={locked}
            >
              <legend className="sr-only">{tj(`criteria.${c.key}.title`)}</legend>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" aria-hidden>{tj(`criteria.${c.key}.title`)}</p>
                  <p id={`crit-${c.id}-hint`} className="mt-0.5 text-xs text-muted-foreground">{tj(`criteria.${c.key}.hint`)}</p>
                </div>
                <span className="tabular shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {t("weight", { weight: c.weight })}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 sm:gap-2">
                {Array.from({ length: c.maxScore }, (_, i) => i + 1).map((v) => {
                  const id = `score-${c.id}-${v}`;
                  return (
                    <div key={v} className="relative">
                      <input
                        type="radio"
                        id={id}
                        name={`score_${c.id}`}
                        value={v}
                        checked={scores[c.id] === v}
                        onChange={() => setScores((s) => ({ ...s, [c.id]: v }))}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={id}
                        className={cn(
                          "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border bg-background px-0.5 py-1.5 text-center transition-colors duration-150",
                          "hover:border-primary/50 hover:bg-accent",
                          "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                          "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                          "peer-disabled:cursor-default peer-disabled:opacity-70 peer-disabled:hover:bg-background peer-disabled:hover:border-border",
                          "peer-checked:peer-disabled:opacity-100 peer-checked:peer-disabled:hover:bg-primary",
                        )}
                      >
                        <span className="tabular text-base font-bold leading-none">{v}</span>
                        <span className="max-w-full text-[10px] leading-tight tracking-tight hyphens-auto [overflow-wrap:anywhere] sm:text-[11px] sm:tracking-normal">{tj(`scale.${v}`)}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
              {err && (
                <p id={`crit-${c.id}-error`} role="alert" className="mt-2 text-xs font-medium text-danger">
                  {t("criterionRequired")}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <Field label={t("comment")} htmlFor="eval-comment" hint={t("commentHint")}>
        <Textarea id="eval-comment" name="comment" defaultValue={initial.comment} maxLength={2000} rows={4} disabled={locked} className="min-h-24" />
      </Field>

      <div className="rounded-lg border border-dashed bg-muted/40 p-3 sm:p-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{t("preview")}</p>
          <p className="tabular text-xl font-bold">
            {score}
            <span className="text-sm font-medium text-muted-foreground"> / 100</span>
          </p>
        </div>
        <ProgressBar value={score} label={t("preview")} showValue={false} tone="brand" className="mt-2" />
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{t("previewHint", { scored: scoredCount, total: criteria.length })}</span>
        </p>
      </div>

      {!locked && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" variant="outline" className="h-10" disabled={pending} aria-busy={pending && lastIntent === "draft"}>
            {pending && lastIntent === "draft" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {tc("actions.saveDraft")}
          </Button>
          <Button type="button" className="h-10" disabled={pending} onClick={requestSubmit} aria-busy={pending && lastIntent === "submit"}>
            {pending && lastIntent === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("submit")}
          </Button>
        </div>
      )}
      {initial.status === "DRAFT" && !locked && (
        <p className="text-right">
          <ToneBadge tone="warning">{t("draftSaved")}</ToneBadge>
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody", { score })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                run("submit");
              }}
            >
              {t("confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
