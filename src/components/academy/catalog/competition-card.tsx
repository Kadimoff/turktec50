import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarClock, ExternalLink, FileText, FolderKanban, StickyNote, UserRound, UsersRound } from "lucide-react";
import { bakuDayDiff, bakuDaysUntil, bakuYmd } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import type { RuleStatusValue } from "./helpers";
import { SubcategoryList } from "./subcategory-list";
import { TrackingDialog } from "./tracking-dialog";
import { StopTrackingButton } from "./stop-tracking-button";
import type { OwnerOption, TrackingFormValue } from "./types";

export type CatalogCompetition = {
  id: string;
  name: string;
  url: string | null;
  theme: string | null;
  subcategories: string[];
  applicationDeadline: Date | null;
  finalDate: Date | null;
  ruleStatus: RuleStatusValue | null;
  ruleSourceUrl: string | null;
  ruleCheckedAt: Date | null;
  ruleNotes: string | null;
  ruleOwner: { id: string; name: string; active: boolean } | null;
  projects: number;
  teams: number;
};

type Admin = { currentUserId: string; owners: OwnerOption[] } | null;

/** One TEKNOFEST catalog card with its 2027 rule tracking (server component; admin controls are client islands). */
/** `canApply`: team members get a shortcut to the public preparation request form with this competition preselected. */
export async function CompetitionCard({ c, locale, today, admin, canApply = false }: { c: CatalogCompetition; locale: string; today: string; admin: Admin; canApply?: boolean }) {
  const [t, tc] = await Promise.all([getTranslations("catalog"), getTranslations("common")]);
  const titleId = `competition-${c.id}`;
  const direction = c.theme && tc.has(`directions.${c.theme}` as never) ? tc(`directions.${c.theme}` as never) : null;
  const tracked = c.ruleStatus !== null;
  const official = c.ruleStatus === "CONFIRMED";
  const deadline = bakuYmd(c.applicationDeadline);
  const final = bakuYmd(c.finalDate);
  const checked = bakuYmd(c.ruleCheckedAt);
  const left = c.applicationDeadline ? bakuDaysUntil(c.applicationDeadline) : null;
  const newTab = t("newTab");

  const unconfirmed = !official && (
    <span className="inline-flex items-center gap-1 text-2xs font-medium text-warning">
      <AlertTriangle className="size-3" aria-hidden />
      {t("card.unconfirmed")}
    </span>
  );

  const form: TrackingFormValue = {
    id: c.id,
    name: c.name,
    status: c.ruleStatus,
    ownerId: c.ruleOwner?.id ?? null,
    ownerName: c.ruleOwner?.name ?? null,
    ownerActive: c.ruleOwner?.active ?? true,
    checkedAt: checked,
    deadline,
    finalDate: final,
    sourceUrl: c.ruleSourceUrl ?? "",
    notes: c.ruleNotes ?? "",
  };

  const showDates = !!(deadline || final);
  const showRules = tracked || showDates;

  return (
    <article aria-labelledby={titleId} className="flex w-full min-w-0 flex-col rounded-xl border bg-card shadow-card">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {direction && <p className="text-xs font-semibold text-primary">{direction}</p>}
            <h3 id={titleId} className="mt-0.5 text-base leading-snug font-semibold text-pretty break-words">{c.name}</h3>
          </div>
          <div className="shrink-0">
            {c.ruleStatus ? <EnumBadge enumName="RuleStatus" value={c.ruleStatus} /> : <ToneBadge tone="neutral" dot={false}>{t("card.notTracked")}</ToneBadge>}
          </div>
        </div>
        <SubcategoryList items={c.subcategories} />
      </div>

      <div className="flex-1 border-t bg-muted/40 px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground">{t("card.rulesTitle")}</p>
        {showRules ? (
          <dl className="mt-2 grid gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
            {showDates && (
              <>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden />{t("card.deadline")}</dt>
                  <dd className="mt-0.5">
                    {deadline ? (
                      <>
                        <span className={cn("tabular font-semibold", left !== null && left < 0 && "text-danger")}>
                          <time dateTime={deadline}>{fmtDate(c.applicationDeadline, locale)}</time>
                        </span>
                        {left !== null && (
                          <span className={cn("tabular", left < 0 ? "text-danger" : "text-muted-foreground")}>
                            {" · "}
                            {left < 0 ? t("card.passed") : left === 0 ? t("card.today") : t("card.daysLeft", { count: left })}
                          </span>
                        )}
                        <span className="block">{unconfirmed}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("card.noDeadline")}</span>
                    )}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarCheck className="size-3.5" aria-hidden />{t("card.finalDate")}</dt>
                  <dd className="mt-0.5">
                    {final ? (
                      <>
                        <time dateTime={final} className="tabular font-semibold">{fmtDate(c.finalDate, locale)}</time>
                        <span className="block">{unconfirmed}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("card.noDate")}</span>
                    )}
                  </dd>
                </div>
              </>
            )}
            {tracked && (
              <>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><UserRound className="size-3.5" aria-hidden />{t("card.owner")}</dt>
                  <dd className="mt-0.5 font-medium break-words">{c.ruleOwner ? c.ruleOwner.name : <span className="font-normal text-muted-foreground">{t("card.noOwner")}</span>}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarCheck className="size-3.5" aria-hidden />{t("card.checked")}</dt>
                  <dd className="mt-0.5">
                    {checked ? (
                      <>
                        <time dateTime={checked} className="tabular font-medium">{fmtDate(c.ruleCheckedAt, locale)}</time>
                        <span className="tabular text-muted-foreground"> · {t("card.daysAgo", { count: Math.max(0, bakuDayDiff(c.ruleCheckedAt!, new Date())) })}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("card.notChecked")}</span>
                    )}
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><FileText className="size-3.5" aria-hidden />{t("card.source")}</dt>
                  <dd className="mt-0.5 min-w-0">
                    {c.ruleSourceUrl ? (
                      <a
                        href={c.ruleSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{c.ruleSourceUrl.replace(/^https:\/\//, "")}</span>
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                        <span className="sr-only">{newTab}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{t("card.noSource")}</span>
                    )}
                  </dd>
                </div>
                {c.ruleNotes && (
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><StickyNote className="size-3.5" aria-hidden />{t("card.notes")}</dt>
                    <dd className="mt-0.5 whitespace-pre-line break-words text-foreground">{c.ruleNotes}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("card.notTrackedNote")}</p>
        )}
        {!tracked && showDates && <p className="mt-2 text-xs text-muted-foreground">{t("card.notTrackedNote")}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-4 py-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t("card.targets")}</span>
          <span className="inline-flex items-center gap-1">
            <FolderKanban className="size-3.5" aria-hidden />
            <span className={cn("tabular", c.projects > 0 && "font-semibold text-foreground")}>{t("card.projects", { count: c.projects })}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersRound className="size-3.5" aria-hidden />
            <span className={cn("tabular", c.teams > 0 && "font-semibold text-foreground")}>{t("card.teams", { count: c.teams })}</span>
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("card.officialPage")}
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">{newTab}</span>
            </a>
          )}
          {canApply && (
            <Link
              href={`/apply?competition=${c.id}`}
              className="group inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary gradient-primary px-3 text-xs font-semibold text-primary-foreground hover:gradient-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("card.apply")}
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
              <span className="sr-only">: {c.name}</span>
            </Link>
          )}
          {admin && (
            <>
              {tracked && <StopTrackingButton competitionId={c.id} name={c.name} />}
              <TrackingDialog value={form} owners={admin.owners} currentUserId={admin.currentUserId} today={today} />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
