import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, MessageSquareWarning, PartyPopper, PencilLine, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { HumanControlNote } from "@/components/shared/notice";
import { intakeTone, toneBar } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { isIntakeTokenShape } from "@/components/intake/token";
import { STUDENT_EDITABLE_STATUSES } from "@/components/intake/shared";
import { isHttpsUrl } from "@/components/academy/catalog/helpers";
import { getIntakeByToken, requestOrigin, type PublicIntake } from "@/components/intake/public/server";
import { CopyLink } from "@/components/intake/public/copy-link";
import { WithdrawButton } from "@/components/intake/public/withdraw-button";
import type { IntakeStatus } from "@/generated/prisma/enums";

// The URL carries the secret token: never send it as a Referer and keep it out of search engines.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("intake.meta");
  return { title: t("status"), referrer: "no-referrer", robots: { index: false, follow: false } };
}

export default async function IntakeStatusPage(props: PageProps<"/apply/status/[token]">) {
  const { token } = await props.params;
  if (!isIntakeTokenShape(token)) notFound();
  const r = await getIntakeByToken(token);
  if (!r) notFound();

  const [t, tc, te, locale, origin] = await Promise.all([
    getTranslations("intake"), getTranslations("common"), getTranslations("enums"), getLocale(), requestOrigin(),
  ]);
  const when = (d: Date) => fmtDateTime(d, locale);
  const editable = (STUDENT_EDITABLE_STATUSES as readonly IntakeStatus[]).includes(r.status);
  const path = `/apply/status/${token}`;
  const lastChange = r.events[r.events.length - 1]?.at ?? r.submittedAt;
  const highlighted = (r.status === "NEEDS_CHANGES" || r.status === "REJECTED") && r.reviewNote;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("status.eyebrow", { code: r.code })} title={r.teamName} description={t("status.description")} />

      <section aria-labelledby="intake-current" className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="intake-current" className="text-sm font-semibold">{t("status.current")}</h2>
          <EnumBadge enumName="IntakeStatus" value={r.status} />
        </div>
        <p className="text-sm text-pretty">{t(`status.info.${r.status}`)}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("status.code")}</dt>
            <dd className="font-mono font-semibold">{r.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("status.submittedAt")}</dt>
            <dd className="font-medium">{when(r.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("status.changedAt")}</dt>
            <dd className="font-medium">{when(lastChange)}</dd>
          </div>
        </dl>

        {highlighted && (
          <div
            role="note"
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4",
              r.status === "NEEDS_CHANGES" ? "border-warning/40 bg-warning-soft" : "border-danger/30 bg-danger-soft",
            )}
          >
            <MessageSquareWarning className={cn("mt-0.5 size-5 shrink-0", r.status === "NEEDS_CHANGES" ? "text-warning" : "text-danger")} aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className={cn("text-sm font-semibold", r.status === "NEEDS_CHANGES" ? "text-warning" : "text-danger")}>
                {t(r.status === "NEEDS_CHANGES" ? "status.note.NEEDS_CHANGES" : "status.note.REJECTED")}
              </p>
              <p className="text-sm whitespace-pre-line text-pretty break-words text-foreground">{r.reviewNote}</p>
              {r.reviewedAt && <p className="text-xs text-muted-foreground">{when(r.reviewedAt)}</p>}
            </div>
          </div>
        )}

        {editable ? (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
            <Button className="h-10 px-4" nativeButton={false} render={<Link href={`${path}/edit`} />}>
              <PencilLine aria-hidden />
              {t(r.status === "NEEDS_CHANGES" ? "status.editFix" : "status.edit")}
            </Button>
            <WithdrawButton token={token} code={r.code} />
          </div>
        ) : r.status === "UNDER_REVIEW" ? (
          <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t("status.locked")}</span>
          </p>
        ) : r.status === "REJECTED" || r.status === "WITHDRAWN" ? (
          <div className="border-t pt-4">
            <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/apply" />}>
              <Plus aria-hidden />
              {t("status.newRequest")}
            </Button>
          </div>
        ) : null}
      </section>

      {r.status === "ACCEPTED" && <Accepted r={r} t={t} />}

      <section aria-labelledby="intake-link" className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <h2 id="intake-link" className="text-sm font-semibold">{t("status.linkTitle")}</h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">{t("status.linkHint")}</p>
        <CopyLink link={origin ? `${origin}${path}` : path} label={t("status.linkLabel")} />
      </section>

      <section aria-labelledby="intake-history" className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <h2 id="intake-history" className="text-sm font-semibold">{t("status.history.title")}</h2>
        <ol className="mt-4 space-y-0">
          {[...r.events].reverse().map((e, i, all) => {
            const tone = intakeTone[e.to] ?? "neutral";
            const label = e.from === null ? t("status.history.submitted") : e.to === "SUBMITTED" ? t("status.history.resubmitted") : t(`status.history.${e.to}`);
            return (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < all.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />}
                <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", toneBar[tone])} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold">{label}</p>
                    <ToneBadge tone={tone} className="text-2xs">{te(`IntakeStatus.${e.to}`)}</ToneBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={e.at.toISOString()}>{when(e.at)}</time>
                    {" · "}
                    {t(e.source === "public" ? "status.history.byTeam" : "status.history.byCoordinator")}
                  </p>
                  {e.note && (
                    <blockquote className="rounded-lg border-l-2 border-border bg-muted/50 px-3 py-2 text-sm whitespace-pre-line text-pretty break-words">
                      {e.note}
                    </blockquote>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <Summary r={r} t={t} tc={tc} />

      <HumanControlNote />
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"intake">>>;
type TC = Awaited<ReturnType<typeof getTranslations<"common">>>;

function Accepted({ r, t }: { r: PublicIntake; t: T }) {
  return (
    <section aria-labelledby="intake-accepted" className="space-y-4 rounded-xl border border-success/30 bg-success-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0">
          <h2 id="intake-accepted" className="text-base font-semibold text-success">{t(r.team ? "status.accepted.title" : "status.accepted.titleGone")}</h2>
          {/* The team may have been removed from the Academy after acceptance (teamId → null): say so instead of "active". */}
          <p className="mt-1 text-sm text-pretty text-foreground">{t(r.team ? "status.accepted.body" : "status.accepted.teamGone")}</p>
        </div>
      </div>
      <dl className="grid gap-3 rounded-lg bg-card p-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t("status.accepted.team")}</dt>
          <dd className="font-semibold break-words">{r.team?.name ?? r.teamName}</dd>
        </div>
        {r.team && (
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t("status.accepted.mentor")}</dt>
            <dd className="font-medium break-words">{r.team.mentor?.name ?? t("status.accepted.noMentor")}</dd>
          </div>
        )}
      </dl>
      {r.team && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("status.accepted.next")}</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-pretty text-foreground marker:text-success">
            <li>{t("status.accepted.n1")}</li>
            <li>{t("status.accepted.n2")}</li>
            <li>{t("status.accepted.n3")}</li>
          </ol>
        </div>
      )}
    </section>
  );
}

function Summary({ r, t, tc }: { r: PublicIntake; t: T; tc: TC }) {
  const direction = r.competition.theme && tc.has(`directions.${r.competition.theme}` as never) ? tc(`directions.${r.competition.theme}` as never) : null;
  const url = r.competition.url && isHttpsUrl(r.competition.url) ? r.competition.url : null;
  const row = "grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4";
  return (
    <section aria-labelledby="intake-summary" className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <h2 id="intake-summary" className="text-sm font-semibold">{t("status.summary.title")}</h2>
      <dl className="mt-2 text-sm">
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.competition")}</dt>
          <dd className="min-w-0 space-y-1">
            <p className="font-medium text-pretty">{r.competition.name}</p>
            {direction && <p className="text-xs text-muted-foreground">{direction}</p>}
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <ExternalLink className="size-3" aria-hidden />
                {t("form.official")}
                <span className="sr-only">{t("form.newTab")}</span>
              </a>
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.subcategory")}</dt>
          <dd className="min-w-0 text-pretty">{r.subcategory ?? t("status.summary.none")}</dd>
        </div>
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.team")}</dt>
          <dd className="min-w-0 space-y-0.5">
            <p className="font-medium break-words">{r.teamName}</p>
            <p className="text-xs text-muted-foreground">{r.university.name}{r.faculty ? ` · ${r.faculty.name}` : ""}</p>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.members", { count: r.members.length })}</dt>
          <dd className="min-w-0">
            <ul className="space-y-1.5">
              {r.members.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium break-words">{m.name}</span>
                  {m.isCaptain && <ToneBadge tone="brand" dot={false} className="text-2xs">{t("form.captain")}</ToneBadge>}
                  {(m.role || m.faculty) && (
                    <span className="text-xs text-muted-foreground">{[m.role, m.faculty?.name].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.idea")}</dt>
          <dd className="min-w-0 whitespace-pre-line text-pretty break-words">{r.projectIdea}</dd>
        </div>
        <div className={row}>
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t("status.summary.needs")}</dt>
          <dd className="min-w-0 space-y-2">
            {r.needs.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {r.needs.map((n) => (
                  <li key={n}>
                    <ToneBadge tone="neutral" dot={false}>{t.has(`needs.${n}` as never) ? t(`needs.${n}` as never) : n}</ToneBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("status.summary.noNeeds")}</p>
            )}
            {r.needsNote && <p className="text-sm whitespace-pre-line text-pretty break-words text-muted-foreground">{r.needsNote}</p>}
          </dd>
        </div>
      </dl>
    </section>
  );
}
