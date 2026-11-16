import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight, CircleAlert, CircleCheck, Crown, ExternalLink, Globe, History, Info, Lightbulb, ShieldAlert, TriangleAlert, Trophy, UsersRound,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { HumanControlNote } from "@/components/shared/notice";
import { UserAvatar } from "@/components/shared/user-avatar";
import { INTAKE_NEEDS, OPEN_INTAKE_STATUSES } from "@/components/intake/shared";
import { checkSelect, computeIntakeChecks } from "./checks";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { DecisionPanel } from "./decision-panel";
import type { CheckIssue, CheckLevel, DecisionRequest, IntakeChecks } from "./types";

const LEVEL: Record<CheckLevel, { icon: LucideIcon; cls: string }> = {
  danger: { icon: CircleAlert, cls: "text-danger" },
  warning: { icon: TriangleAlert, cls: "text-warning" },
  info: { icon: Info, cls: "text-info" },
};

function Card({ title, icon: Icon, children, className, id, action }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string; id?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-4 shadow-card sm:p-5", className)} aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Detail of one preparation request (ADMIN): everything submitted, control checks, decision panel and the status history. */
export async function IntakeDetail({ id }: { id: string }) {
  const [t, tc, te, locale] = await Promise.all([getTranslations("intakeAdmin"), getTranslations("common"), getTranslations("enums"), getLocale()]);

  const r = await prisma.intakeRequest.findUnique({
    where: { id },
    select: {
      ...checkSelect,
      code: true, status: true, submittedAt: true, updatedAt: true, consentAt: true, subcategory: true, projectIdea: true, needs: true, needsNote: true,
      reviewNote: true, reviewedAt: true,
      reviewer: { select: { name: true } },
      university: { select: { name: true, shortName: true } },
      competition: {
        select: { id: true, name: true, url: true, theme: true, catalogId: true, ruleStatus: true, ruleOwner: { select: { name: true } } },
      },
      team: { select: { id: true, name: true, status: true } },
      members: {
        select: { id: true, name: true, email: true, role: true, isCaptain: true, facultyId: true, faculty: { select: { name: true, status: true, universityId: true } } },
        orderBy: { order: "asc" },
      },
      events: { select: { id: true, from: true, to: true, note: true, source: true, at: true, actor: { select: { name: true } } }, orderBy: { at: "asc" } },
    },
  });
  if (!r) notFound();

  const open = (OPEN_INTAKE_STATUSES as readonly string[]).includes(r.status);
  const [checksMap, mentors] = await Promise.all([
    open ? computeIntakeChecks(prisma, [r]) : Promise.resolve(new Map<string, IntakeChecks>()),
    r.status === "UNDER_REVIEW"
      ? prisma.user.findMany({
          where: { role: "MENTOR", active: true },
          select: { id: true, name: true, _count: { select: { mentoredTeams: { where: { status: { not: "ARCHIVED" } } } } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const checks = checksMap.get(r.id);
  const captain = r.members.find((m) => m.isCaptain) ?? r.members[0];
  const existingStudents = checks ? Object.values(checks.members).filter((list) => list.some((i) => i.key === "existing")).length : 0;
  const needs = r.needs.filter((n) => (INTAKE_NEEDS as readonly string[]).includes(n));
  const untracked = r.competition.catalogId !== null && r.competition.ruleStatus === null;

  const decision: DecisionRequest = {
    id: r.id,
    code: r.code,
    teamName: r.teamName,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    memberCount: r.members.length,
    existingStudents,
    captainName: captain?.name ?? "—",
    competitionName: r.competition.name,
    subcategory: r.subcategory,
    untracked,
    blocking: checks?.blocking ?? 0,
    teamId: r.team?.id ?? null,
  };

  const issueText = (i: CheckIssue) => t(`checks.${i.key}`, i.params ?? {});
  const issueList = (issues: CheckIssue[], className?: string) =>
    issues.length === 0 ? null : (
      <ul className={cn("space-y-1", className)}>
        {issues.map((i, n) => {
          const L = LEVEL[i.level];
          return (
            <li key={`${i.key}-${n}`} className={cn("flex items-start gap-1.5 text-xs", i.level === "info" ? "text-muted-foreground" : L.cls, i.level !== "info" && "font-medium")}>
              <L.icon className={cn("mt-px size-3.5 shrink-0", L.cls)} aria-hidden />
              <span>
                <span className="sr-only">{t(`checks.level.${i.level}`)}: </span>
                {issueText(i)}
              </span>
            </li>
          );
        })}
      </ul>
    );

  const tracking = r.competition.ruleStatus ? (
    <EnumBadge enumName="RuleStatus" value={r.competition.ruleStatus} />
  ) : r.competition.catalogId !== null ? (
    <ToneBadge tone="warning">{t("detail.notTracked")}</ToneBadge>
  ) : (
    <ToneBadge tone="neutral">{t("detail.notCatalog")}</ToneBadge>
  );

  return (
    <div className="space-y-6">
      {checks && (
        <section
          aria-labelledby="checks-title"
          className={cn(
            "rounded-xl border p-4 shadow-card",
            checks.blocking > 0 ? "border-danger/40 bg-danger-soft" : checks.warnings > 0 ? "border-warning/40 bg-warning-soft" : "bg-card",
          )}
        >
          <div className="flex items-start gap-3">
            {checks.blocking > 0 ? (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            ) : checks.warnings > 0 ? (
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            )}
            <div className="min-w-0 space-y-1.5">
              <h2 id="checks-title" className="text-sm font-semibold">
                {checks.blocking > 0
                  ? t("checks.summary.blocking", { count: checks.blocking })
                  : checks.warnings > 0
                    ? t("checks.summary.warnings", { count: checks.warnings })
                    : t("checks.summary.clean")}
              </h2>
              <p className="text-xs text-pretty text-foreground/80">
                {checks.blocking > 0 ? t("checks.summary.blockingHint") : checks.warnings > 0 ? t("checks.summary.warningsHint") : t("checks.summary.cleanHint")}
              </p>
              {issueList(checks.request, "pt-1")}
              {checks.blocking + checks.warnings > checks.request.filter((i) => i.level !== "info").length && (
                <p className="text-xs text-foreground/80">{t("checks.summary.seeMembers")}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="min-w-0 space-y-6">
          <Card title={t("detail.competition")} icon={Trophy} id="sec-competition">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t("detail.competitionName")}</dt>
                <dd className="mt-0.5 font-medium text-pretty">
                  {r.competition.url ? (
                    <a href={r.competition.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 hover:text-primary hover:underline">
                      {r.competition.name}
                      <ExternalLink className="mt-1 size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">{t("detail.opensNewTab")}</span>
                    </a>
                  ) : (
                    r.competition.name
                  )}
                </dd>
                {r.competition.theme && tc.has(`directions.${r.competition.theme}`) && (
                  <dd className="text-xs text-muted-foreground">{tc(`directions.${r.competition.theme}`)}</dd>
                )}
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.subcategory")}</dt>
                <dd className="mt-0.5 text-pretty">{r.subcategory ?? <span className="text-muted-foreground">{t("detail.noSubcategory")}</span>}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.tracking")}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {tracking}
                  {r.competition.ruleOwner && <span className="text-xs text-muted-foreground">{t("detail.ruleOwner", { name: r.competition.ruleOwner.name })}</span>}
                </dd>
                {untracked && <dd className="mt-1 text-xs text-muted-foreground">{t("detail.untrackedHint")}</dd>}
              </div>
            </dl>
            <Link href="/academy/catalog" className="mt-4 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t("detail.openCatalog")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Card>

          <Card title={t("detail.team")} icon={Globe} id="sec-team">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.teamName")}</dt>
                <dd className="mt-0.5 font-medium text-pretty">{r.teamName}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.university")}</dt>
                <dd className="mt-0.5 text-pretty">{r.university.name}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.faculty")}</dt>
                <dd className="mt-0.5 text-pretty">
                  {r.faculty ? r.faculty.name : <span className="text-muted-foreground">{t("detail.noFaculty")}</span>}
                  {r.faculty?.status === "ARCHIVED" && <span className="ml-1.5 text-xs font-medium text-danger">{t("detail.archived")}</span>}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("detail.consent")}</dt>
                <dd className="tabular mt-0.5">{fmtDateTime(r.consentAt, locale)}</dd>
              </div>
              {r.team && (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("detail.academyTeam")}</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <Link href={`/academy/teams?team=${r.team.id}`} className="font-medium text-primary hover:underline">{r.team.name}</Link>
                    <EnumBadge enumName="TeamStatus" value={r.team.status} />
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title={t("detail.members", { count: r.members.length })} icon={UsersRound} id="sec-members">
            {r.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("detail.noMembers")}</p>
            ) : (
              <ul className="divide-y">
                {r.members.map((m) => {
                  const issues = checks?.members[m.id] ?? [];
                  const hasDanger = issues.some((i) => i.level === "danger");
                  return (
                    <li key={m.id} className={cn("flex items-start gap-3 py-3 first:pt-0 last:pb-0")}>
                      <UserAvatar name={m.name} size="sm" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                          {m.name}
                          {m.isCaptain && (
                            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-warning">
                              <Crown className="size-3" aria-hidden />
                              {t("detail.captain")}
                            </span>
                          )}
                          {hasDanger && <ToneBadge tone="danger" dot={false} className="px-2 py-0 text-2xs">{t("detail.conflict")}</ToneBadge>}
                        </p>
                        <p className="text-xs break-all text-muted-foreground">{m.email}</p>
                        <p className="text-xs text-pretty text-muted-foreground">
                          {[m.role || t("detail.noRole"), m.faculty?.name ?? t("detail.noFaculty")].join(" · ")}
                          {m.faculty?.status === "ARCHIVED" && <span className="ml-1.5 font-medium text-danger">{t("detail.archived")}</span>}
                        </p>
                        {issueList(issues, "pt-1")}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={t("detail.ideaNeeds")} icon={Lightbulb} id="sec-idea">
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">{t("detail.idea")}</h3>
                <p className="mt-1 text-pretty whitespace-pre-line">{r.projectIdea}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">{t("detail.needs")}</h3>
                {needs.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">{t("detail.noNeeds")}</p>
                ) : (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {needs.map((n) => (
                      <li key={n}><ToneBadge tone="brand" dot={false}>{t(`needs.${n}`)}</ToneBadge></li>
                    ))}
                  </ul>
                )}
              </div>
              {r.needsNote && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">{t("detail.needsNote")}</h3>
                  <p className="mt-1 text-pretty whitespace-pre-line">{r.needsNote}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20">
          <Card title={t("decision.title")} id="sec-decision">
            <DecisionPanel request={decision} mentors={mentors.map((m) => ({ id: m.id, name: m.name, teams: m._count.mentoredTeams }))} note={<HumanControlNote />} />
            {r.reviewNote && (
              <div className="mt-4 border-t pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("decision.lastNote")}</h3>
                <p className="mt-1 text-sm text-pretty whitespace-pre-line">{r.reviewNote}</p>
                {r.reviewedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[r.reviewer?.name ?? t("history.deletedUser"), fmtDateTime(r.reviewedAt, locale)].join(" · ")}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card
            title={t("history.title")}
            icon={History}
            id="sec-history"
            action={<Link href="/admin/audit?group=intake" className="text-xs font-semibold text-primary hover:underline">{t("history.audit")}</Link>}
          >
            {r.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-4">
                {[...r.events].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {e.from && (
                        <>
                          <span className="text-muted-foreground">{te(`IntakeStatus.${e.from}`)}</span>
                          <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                          <span className="sr-only">{t("history.to")}</span>
                        </>
                      )}
                      <EnumBadge enumName="IntakeStatus" value={e.to} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{e.source === "public" ? t("history.publicForm") : (e.actor?.name ?? t("history.deletedUser"))}</span>
                      {" · "}
                      <time dateTime={e.at.toISOString()} title={fmtRelative(e.at, locale)}>{fmtDateTime(e.at, locale)}</time>
                    </p>
                    {e.note && <p className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-pretty whitespace-pre-line">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
