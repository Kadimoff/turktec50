import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ClipboardCheck, MessageSquareText, Scale, Sigma, Users } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Aggregate, JurorStatus } from "./data";
import { DISAGREEMENT_THRESHOLD, fmtScore } from "./scoring";

const statusTone: Record<JurorStatus, "success" | "warning" | "neutral"> = { SUBMITTED: "success", DRAFT: "warning", NOT_STARTED: "neutral" };

export async function JurorStatusBadge({ status }: { status: JurorStatus }) {
  const t = await getTranslations("jury");
  return <ToneBadge tone={statusTone[status]}>{t(`status.${status}`)}</ToneBadge>;
}

/** ADMIN: aggregated panel view of one project's evaluations (informative only, no ranking / decision). */
export async function AggregatePanel({ agg }: { agg: Aggregate }) {
  const [t, locale] = await Promise.all([getTranslations("jury"), getLocale()]);
  const submitted = agg.jurors.filter((j) => j.status === "SUBMITTED");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("panel.submitted")}
          value={t("panel.ofAssigned", { done: agg.submittedCount, total: agg.assignedCount })}
          icon={ClipboardCheck}
          tone="info"
          target={Math.max(agg.assignedCount, 1)}
          current={agg.submittedCount}
          hint={agg.draftCount > 0 ? t("panel.draftsHint", { count: agg.draftCount }) : undefined}
        />
        <StatCard label={t("panel.weightedAvg")} value={fmtScore(agg.weightedAvg)} icon={Sigma} tone="brand" hint={t("panel.informative")} />
        <StatCard
          label={t("panel.spread")}
          value={fmtScore(agg.weightedSpread)}
          icon={Scale}
          tone={agg.disagreement ? "warning" : "neutral"}
          hint={t("panel.spreadHint", { threshold: DISAGREEMENT_THRESHOLD })}
        />
        <StatCard label={t("panel.jurors")} value={agg.jurors.length} icon={Users} tone="neutral" hint={t("panel.jurorsHint")} />
      </div>

      {agg.disagreement && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{t("panel.disagreementTitle")}</p>
            <p className="text-xs">{t("panel.disagreementBody", { spread: fmtScore(agg.weightedSpread), threshold: DISAGREEMENT_THRESHOLD })}</p>
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="agg-table-title">
        <div className="flex flex-col gap-1 border-b px-4 py-3 sm:px-5">
          <h2 id="agg-table-title" className="text-sm font-semibold">{t("panel.tableTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("panel.tableHint")}</p>
        </div>
        {agg.jurors.length === 0 ? (
          <div className="p-4"><EmptyState icon={Users} title={t("panel.noJurors")} description={t("panel.noJurorsHint")} /></div>
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-semibold text-muted-foreground sm:pl-5">{t("panel.criterion")}</TableHead>
                <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("panel.weight")}</TableHead>
                {agg.jurors.map((j) => (
                  <TableHead key={j.id} className="h-auto py-2 text-right align-bottom text-xs font-semibold text-muted-foreground">
                    <span className="block max-w-36 truncate text-foreground" title={j.name}>{j.name}</span>
                    <span className="mt-1 inline-block"><JurorStatusBadge status={j.status} /></span>
                  </TableHead>
                ))}
                <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("panel.average")}</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground sm:pr-5">{t("panel.criterionSpread")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agg.perCriterion.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 font-medium whitespace-normal sm:pl-5">{t(`criteria.${c.key}.title`)}</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">{c.weight}%</TableCell>
                  {agg.jurors.map((j) => (
                    <TableCell key={j.id} className="tabular text-right">
                      {typeof j.scores[c.id] === "number" ? j.scores[c.id] : <span className="text-muted-foreground" aria-label={t("panel.noScore")}>—</span>}
                    </TableCell>
                  ))}
                  <TableCell className="tabular text-right font-semibold">{fmtScore(c.avg)}</TableCell>
                  <TableCell className={cn("tabular pr-4 text-right sm:pr-5", (c.spread ?? 0) >= 2 ? "font-semibold text-warning" : "text-muted-foreground")}>
                    {c.spread === null ? "—" : c.spread}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="pl-4 font-semibold sm:pl-5">{t("panel.weightedRow")}</TableCell>
                <TableCell className="tabular text-right text-muted-foreground">100%</TableCell>
                {agg.jurors.map((j) => (
                  <TableCell key={j.id} className="tabular text-right font-semibold">{fmtScore(j.weighted)}</TableCell>
                ))}
                <TableCell className="tabular text-right font-bold">{fmtScore(agg.weightedAvg)}</TableCell>
                <TableCell className={cn("tabular pr-4 text-right sm:pr-5", agg.disagreement ? "font-bold text-warning" : "font-semibold")}>
                  {fmtScore(agg.weightedSpread)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{t("panel.draftPrivacy")}</p>
      </section>

      <section aria-labelledby="agg-comments-title" className="space-y-3">
        <h2 id="agg-comments-title" className="text-sm font-semibold">{t("panel.commentsTitle")}</h2>
        {submitted.length === 0 ? (
          <EmptyState icon={MessageSquareText} title={t("panel.noSubmitted")} description={t("panel.noSubmittedHint")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {submitted.map((j) => (
              <li key={j.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <UserAvatar name={j.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{j.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {j.title ?? ""}
                      {j.title ? " · " : ""}
                      {fmtDateTime(j.submittedAt, locale)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 rounded-lg bg-muted px-2 py-1 text-sm font-bold" title={t("panel.weightedRow")}>
                    {fmtScore(j.weighted)}
                  </span>
                </div>
                <CommentBlock label={t("feedback.comment")} text={j.comment} empty={t("feedback.noComment")} />
                <CommentBlock label={t("feedback.recommendation")} text={j.recommendation} empty={t("feedback.noRecommendation")} advisory={t("feedback.advisory")} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function CommentBlock({ label, text, empty, advisory }: { label: string; text: string | null; empty: string; advisory?: string }) {
  return (
    <div className="mt-3">
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold tracking-wide text-muted-foreground">
        {label}
        {advisory && <span className="rounded-full bg-info-soft px-1.5 text-[11px] font-medium text-info">{advisory}</span>}
      </p>
      {text ? (
        <p className="mt-1 text-sm whitespace-pre-line text-pretty">{text}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground italic">{empty}</p>
      )}
    </div>
  );
}
