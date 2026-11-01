"use client";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Info, Loader2, Lock, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ToneBadge } from "@/components/shared/tone-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveEvaluation } from "@/app/(app)/projects/[id]/evaluations/actions";
import { fmtScore, weightedPreview, type RubricCriterionLite } from "./scoring";

type Props = {
  projectId: string;
  kind: "MIDTERM" | "FINAL";
  criteria: RubricCriterionLite[];
  initial: {
    status: "DRAFT" | "SUBMITTED" | null;
    submittedAt: string | null;
    updatedAt: string | null;
    scores: Record<string, number>;
    comment: string;
    recommendation: string;
  };
};

export function RubricForm({ projectId, kind, criteria, initial }: Props) {
  const t = useTranslations("jury");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [scores, setScores] = useState<Record<string, number>>(initial.scores);
  const [comment, setComment] = useState(initial.comment);
  const [recommendation, setRecommendation] = useState(initial.recommendation);
  const [status, setStatus] = useState(initial.status);
  const [submittedAt, setSubmittedAt] = useState(initial.submittedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [pendingIntent, setPendingIntent] = useState<"save" | "submit" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = status === "SUBMITTED";
  const scoredCount = criteria.filter((c) => typeof scores[c.id] === "number").length;
  const complete = scoredCount === criteria.length;
  const preview = useMemo(() => weightedPreview(criteria, scores), [criteria, scores]);

  function setScore(id: string, v: number) {
    setScores((s) => ({ ...s, [id]: v }));
    setDirty(true);
  }

  function run(intent: "save" | "submit") {
    setPendingIntent(intent);
    start(async () => {
      const res = await saveEvaluation({ projectId, kind, intent, scores, comment, recommendation });
      setPendingIntent(null);
      setConfirmOpen(false);
      if (res.ok) {
        setStatus(res.status);
        setSubmittedAt(res.submittedAt);
        setDirty(false);
        toast.success(intent === "submit" ? t("form.toastSubmitted") : t("form.toastSaved"));
      } else {
        toast.error(t(`form.errors.${res.error}`));
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-4">
        {locked && (
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success" role="status">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{t("form.lockedTitle")}</p>
              <p className="text-xs">{t("form.lockedBody", { date: fmtDateTime(submittedAt, locale) })}</p>
            </div>
          </div>
        )}

        {criteria.map((c, idx) => {
          const titleId = `crit-${c.id}-title`;
          const hintId = `crit-${c.id}-hint`;
          const value = scores[c.id];
          return (
            <div key={c.id} className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
              <fieldset aria-describedby={hintId} disabled={locked || pending} className="min-w-0">
                <legend id={titleId} className="flex w-full items-start justify-between gap-3 text-sm font-semibold">
                  <span className="flex items-start gap-2.5">
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground" aria-hidden>
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{t(`criteria.${c.key}.title`)}</span>
                  </span>
                  <span className="tabular shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t("form.weight", { weight: c.weight })}
                  </span>
                </legend>
                <p id={hintId} className="mt-1.5 pl-8.5 text-xs text-muted-foreground">
                  {t(`criteria.${c.key}.hint`)}
                </p>
                <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
                  {Array.from({ length: c.maxScore }, (_, i) => i + 1).map((n) => {
                    const id = `crit-${c.id}-${n}`;
                    return (
                      <label key={n} htmlFor={id} className="group relative block min-w-0">
                        <input
                          id={id}
                          type="radio"
                          name={`crit-${c.id}`}
                          value={n}
                          checked={value === n}
                          onChange={() => setScore(c.id, n)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border bg-background px-1 py-2 text-center transition-colors duration-150",
                            "hover:border-primary/50 hover:bg-accent/60",
                            "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                            "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                            "peer-disabled:cursor-not-allowed peer-disabled:hover:border-border peer-disabled:hover:bg-background",
                            "peer-disabled:peer-checked:hover:border-primary peer-disabled:peer-checked:hover:bg-primary",
                            "dark:bg-input/30",
                          )}
                        >
                          <span className="tabular text-base font-bold leading-none">{n}</span>
                          <span className="line-clamp-2 text-[10.5px] leading-tight font-medium opacity-90 sm:text-[11px]">
                            {t(`scale.${n}` as never)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          );
        })}

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="eval-comment" className="text-[13px] font-medium">{t("form.comment")}</Label>
            <Textarea
              id="eval-comment"
              value={comment}
              onChange={(e) => { setComment(e.target.value); setDirty(true); }}
              disabled={locked || pending}
              maxLength={3000}
              rows={4}
              aria-describedby="eval-comment-hint"
              placeholder={t("form.commentPlaceholder")}
            />
            <p id="eval-comment-hint" className="text-xs text-muted-foreground">{t("form.commentHint")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-rec" className="text-[13px] font-medium">{t("form.recommendation")}</Label>
            <Textarea
              id="eval-rec"
              value={recommendation}
              onChange={(e) => { setRecommendation(e.target.value); setDirty(true); }}
              disabled={locked || pending}
              maxLength={1500}
              rows={3}
              aria-describedby="eval-rec-hint"
              placeholder={t("form.recommendationPlaceholder")}
            />
            <p id="eval-rec-hint" className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              {t("form.recommendationHint")}
            </p>
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20" aria-label={t("form.summary")}>
        <div className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("form.summary")}</p>
            {status === "SUBMITTED" ? (
              <ToneBadge tone="success">{t("status.SUBMITTED")}</ToneBadge>
            ) : status === "DRAFT" ? (
              <ToneBadge tone="warning">{t("status.DRAFT")}</ToneBadge>
            ) : (
              <ToneBadge tone="neutral">{t("status.NOT_STARTED")}</ToneBadge>
            )}
          </div>
          <div className="mt-4 flex items-baseline gap-1.5" aria-live="polite">
            <span className="tabular text-4xl font-bold tracking-tight">{fmtScore(preview)}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("form.previewLabel")}</p>
          <ProgressBar className="mt-3" value={preview} tone="brand" label={t("form.previewLabel")} showValue={false} />
          <p className="tabular mt-3 text-xs text-muted-foreground">{t("form.scoredCount", { done: scoredCount, total: criteria.length })}</p>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-info-soft px-2.5 py-2 text-xs text-info">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("form.previewNote")}
          </p>

          {!locked && (
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10"
                onClick={() => run("save")}
                disabled={pending}
                aria-busy={pendingIntent === "save"}
              >
                {pendingIntent === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                {pendingIntent === "save" ? tc("states.loading") : tc("actions.saveDraft")}
              </Button>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger render={<Button type="button" size="lg" className="h-10" disabled={pending || !complete} />}>
                  <Send className="size-4" aria-hidden />
                  {t("form.submit")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("form.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("form.confirmBody", { score: fmtScore(preview) })}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>{tc("actions.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => run("submit")} disabled={pending} aria-busy={pendingIntent === "submit"}>
                      {pendingIntent === "submit" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      {t("form.confirmAction")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!complete && <p className="text-xs text-muted-foreground">{t("form.completeToSubmit")}</p>}
              {dirty ? (
                <p className="text-xs font-medium text-warning">{t("form.unsaved")}</p>
              ) : initial.updatedAt && status === "DRAFT" ? (
                <p className="text-xs text-muted-foreground">{t("form.draftSaved")}</p>
              ) : null}
            </div>
          )}
          {locked && (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {t("form.submittedAt", { date: fmtDateTime(submittedAt, locale) })}
            </p>
          )}
        </div>
        <p className="px-1 text-xs text-muted-foreground">{t("form.privacy")}</p>
      </aside>
    </div>
  );
}
