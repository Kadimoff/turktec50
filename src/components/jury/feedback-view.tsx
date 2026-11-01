import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, MessageSquareText, Sigma, UsersRound } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PROGRAM } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { Aggregate, EvalKind } from "./data";
import { fmtScore } from "./scoring";
import { CommentBlock } from "./aggregate-panel";

/**
 * TEAM / MENTOR: anonymised feedback — per-criterion averages, comments and advisory next steps
 * from SUBMITTED evaluations only, without juror names or individual scores.
 */
export async function FeedbackView({ agg, kind }: { agg: Aggregate; kind: EvalKind }) {
  const [t, te, locale] = await Promise.all([getTranslations("jury"), getTranslations("enums"), getLocale()]);
  const date = kind === "FINAL" ? PROGRAM.mockFinal : PROGRAM.midtermJury;

  if (agg.submittedCount === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t("feedback.emptyTitle")}
        description={t("feedback.emptyBody", { round: te(`RubricKind.${kind}`), date: fmtDate(date, locale) })}
      />
    );
  }

  // anonymise: drop names, order by submission time (not by name / score)
  const notes = agg.jurors
    .filter((j) => j.status === "SUBMITTED")
    .sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0))
    .map((j) => ({ comment: j.comment, recommendation: j.recommendation }))
    .filter((n) => n.comment || n.recommendation);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t("feedback.evaluations")} value={agg.submittedCount} icon={UsersRound} tone="info" hint={t("feedback.evaluationsHint")} />
        <StatCard label={t("feedback.average")} value={fmtScore(agg.weightedAvg)} icon={Sigma} tone="brand" hint={t("panel.informative")} />
        <StatCard label={t("feedback.round")} value={te(`RubricKind.${kind}`)} icon={CalendarClock} tone="neutral" hint={fmtDate(date, locale)} />
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5" aria-labelledby="fb-criteria">
        <h2 id="fb-criteria" className="text-sm font-semibold">{t("feedback.criteriaTitle")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("feedback.criteriaHint")}</p>
        <ul className="mt-4 space-y-4">
          {agg.perCriterion.map((c) => {
            const pct = c.avg === null ? 0 : (c.avg / c.maxScore) * 100;
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">
                    {t(`criteria.${c.key}.title`)}
                    <span className="tabular ml-2 text-xs font-normal text-muted-foreground">{t("form.weight", { weight: c.weight })}</span>
                  </p>
                  <p className="tabular shrink-0 text-sm font-semibold">
                    {fmtScore(c.avg)} <span className="text-xs font-normal text-muted-foreground">/ {c.maxScore}</span>
                  </p>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${t(`criteria.${c.key}.title`)}: ${fmtScore(c.avg)} / ${c.maxScore}`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t(`criteria.${c.key}.hint`)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="fb-notes" className="space-y-3">
        <div>
          <h2 id="fb-notes" className="text-sm font-semibold">{t("feedback.notesTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("feedback.notesHint")}</p>
        </div>
        {notes.length === 0 ? (
          <EmptyState icon={MessageSquareText} title={t("feedback.noNotes")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {notes.map((n, i) => (
              <li key={i} className="min-w-0 rounded-xl border bg-card p-4 shadow-card">
                <p className="text-xs font-semibold text-primary">{t("feedback.noteN", { n: i + 1 })}</p>
                <CommentBlock label={t("feedback.comment")} text={n.comment} empty={t("feedback.noComment")} />
                <CommentBlock label={t("feedback.recommendation")} text={n.recommendation} empty={t("feedback.noRecommendation")} advisory={t("feedback.advisory")} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
