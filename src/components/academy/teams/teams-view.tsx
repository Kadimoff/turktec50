import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Circle, Crown, FileCheck2, FileText, ShieldCheck, Trophy, UserRoundSearch, Users, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { TeamStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { matchesQuery } from "@/lib/search";
import { buildHref, one, pick, str, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { HumanControlNote } from "@/components/shared/notice";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadFacultyOptions, loadUniversityOptions } from "@/components/academy/students/server";
import { TeamOptionsProvider } from "./team-options";
import { TeamFormDialog } from "./team-form-dialog";
import { TeamRowActions } from "./team-row-actions";
import { CreateApplicationDialog } from "./create-application-dialog";
import { OPEN_APPLICATION_STATUSES, TEAM_STATUSES, type ApplicationTeamValue, type TeamFormOptions, type TeamFormValue } from "./types";

const BASE = "/academy/teams";
const STATUS_FILTERS = ["active", ...TEAM_STATUSES, "all"] as const;
const STATUS_ORDER: Record<TeamStatus, number> = { ACTIVE: 0, FORMING: 1, ARCHIVED: 2 };
const isOpen = (s: string) => (OPEN_APPLICATION_STATUSES as readonly string[]).includes(s);

const teamSelect = {
  id: true, name: true, status: true, notes: true, universityId: true, facultyId: true, mentorId: true, competitionId: true, captainId: true, createdAt: true,
  university: { select: { shortName: true, name: true } },
  faculty: { select: { name: true } },
  mentor: { select: { id: true, name: true, active: true } },
  competition: { select: { id: true, name: true } },
  captain: { select: { id: true, name: true, email: true, teamId: true } },
  members: { select: { id: true, name: true, email: true, skills: true, faculty: { select: { name: true } } }, orderBy: { name: "asc" } },
  applications: { select: { id: true, code: true, status: true, projectTitle: true, submittedAt: true }, orderBy: { submittedAt: "desc" } },
} satisfies Prisma.TeamSelect;
type TeamRow = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;

/** Readiness for "create application": ACTIVE, competition, captain (a member), ≥1 member, no open application. */
function readiness(tm: TeamRow) {
  const checks = {
    active: tm.status === "ACTIVE",
    competition: !!tm.competitionId,
    captain: !!tm.captain && tm.captain.teamId === tm.id,
    members: tm.members.length >= 1,
    noOpen: !tm.applications.some((a) => isOpen(a.status)),
  };
  return { checks, eligible: Object.values(checks).every(Boolean) };
}

/** Academy teams (ADMIN): stats, filters, list (table ≥ xl, stacked cards below), detail panel for ?team=. */
export async function TeamsView({ searchParams: sp }: { searchParams: SearchParams }) {
  const [t, te, tc, locale] = await Promise.all([getTranslations("teams"), getTranslations("enums"), getTranslations("common"), getLocale()]);

  const q = str(sp.q, 80) ?? "";
  const status = pick(sp.status, STATUS_FILTERS, "active");
  const facultyParam = one(sp.faculty) || undefined;
  const uniParam = one(sp.university) || undefined;
  const focusId = one(sp.team) || undefined;

  const [{ universities, defaultUniversityId }, faculties, all, seeking] = await Promise.all([
    loadUniversityOptions(),
    loadFacultyOptions(),
    prisma.team.findMany({ select: teamSelect }),
    prisma.student.count({ where: { status: "SEEKING_TEAM" } }),
  ]);
  const teamUnis = new Set(all.map((tm) => tm.universityId));
  const multiUni = teamUnis.size > 1;
  const facultyFilter = facultyParam && (facultyParam === "none" || faculties.some((f) => f.id === facultyParam)) ? facultyParam : undefined;
  const uniFilter = uniParam && teamUnis.has(uniParam) ? uniParam : undefined;

  const [mentors, competitions, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MENTOR", OR: [{ active: true }, { id: { in: all.map((tm) => tm.mentorId).filter((x): x is string => !!x) } }] },
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.competition.findMany({
      where: { OR: [{ catalogId: null }, { ruleStatus: { not: null } }, { id: { in: all.map((tm) => tm.competitionId).filter((x): x is string => !!x) } }] },
      select: { id: true, name: true, catalogId: true, ruleStatus: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { OR: [{ teamId: null, status: { not: "ARCHIVED" } }, { teamId: { not: null } }] },
      select: { id: true, name: true, email: true, universityId: true, teamId: true, status: true, faculty: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const options: TeamFormOptions = {
    universities,
    defaultUniversityId,
    faculties,
    mentors,
    competitions: competitions.map((c) => ({ id: c.id, name: c.name, eligible: c.catalogId === null || c.ruleStatus !== null })),
    students: students.map((s) => ({ id: s.id, name: s.name, email: s.email, universityId: s.universityId, teamId: s.teamId, status: s.status, faculty: s.faculty?.name ?? null })),
  };

  // ---- stats (whole register, independent of filters)
  const nonArchived = all.filter((tm) => tm.status !== "ARCHIVED");
  const activeN = all.filter((tm) => tm.status === "ACTIVE").length;
  const formingN = all.filter((tm) => tm.status === "FORMING").length;
  const readyN = all.filter((tm) => readiness(tm).eligible).length;
  const appliedN = all.filter((tm) => tm.applications.some((a) => isOpen(a.status))).length;

  // ---- filters
  const listed = all
    .filter((tm) => (status === "all" ? true : status === "active" ? tm.status !== "ARCHIVED" : tm.status === status))
    .filter((tm) => !facultyFilter || (facultyFilter === "none" ? tm.facultyId === null : tm.facultyId === facultyFilter))
    .filter((tm) => !uniFilter || tm.universityId === uniFilter)
    .filter((tm) => matchesQuery(q, tm.name, tm.mentor?.name, ...tm.members.flatMap((m) => [m.name, m.email]), ...tm.applications.map((a) => a.code)))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, locale));
  const focus = focusId ? all.find((tm) => tm.id === focusId) : undefined;

  const params = { q: q || undefined, status: status === "active" ? undefined : status, faculty: facultyFilter, university: uniFilter };
  const href = (patch: Record<string, string | undefined>) => buildHref(BASE, { ...params, team: focus?.id }, patch);
  const filtered = !!(q || status !== "active" || facultyFilter || uniFilter);
  const facultyChoices = faculties.filter((f) => (uniFilter ? f.universityId === uniFilter : teamUnis.has(f.universityId)));
  const note = <HumanControlNote />;

  const toForm = (tm: TeamRow): TeamFormValue => ({
    id: tm.id,
    name: tm.name,
    universityId: tm.universityId,
    facultyId: tm.facultyId,
    mentorId: tm.mentorId,
    competitionId: tm.competitionId,
    status: tm.status,
    notes: tm.notes,
    captainId: tm.captainId,
    memberIds: tm.members.map((m) => m.id),
  });
  const toApp = (tm: TeamRow): ApplicationTeamValue => ({
    id: tm.id,
    name: tm.name,
    university: tm.university.name,
    competition: tm.competition?.name ?? "",
    captainName: tm.captain?.name ?? "",
    captainEmail: tm.captain?.email ?? "",
    memberCount: tm.members.length,
  });

  const latestApp = (tm: TeamRow) => {
    const a = tm.applications[0];
    if (!a) return <span className="text-xs text-muted-foreground">{t("teams.table.noApplication")}</span>;
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Link href={`/applications/${a.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{a.code}</Link>
          <EnumBadge enumName="ApplicationStatus" value={a.status} />
        </span>
        {tm.applications.length > 1 && <span className="text-2xs text-muted-foreground">{t("teams.table.earlier", { count: tm.applications.length - 1 })}</span>}
      </span>
    );
  };
  const mentorCell = (tm: TeamRow) =>
    tm.mentor ? (
      <span className="flex min-w-0 items-center gap-2">
        <UserAvatar name={tm.mentor.name} size="sm" />
        <span className="truncate text-xs">{tm.mentor.active ? tm.mentor.name : t("teams.form.inactive", { name: tm.mentor.name })}</span>
      </span>
    ) : (
      <span className="text-xs font-medium text-warning">{t("teams.table.noMentor")}</span>
    );
  const membersCell = (tm: TeamRow) => (
    <span className="block text-xs">
      <span className="tabular font-medium">{tc("members", { count: tm.members.length })}</span>
      {tm.captain ? (
        <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
          <Crown className="size-3 shrink-0 text-warning" aria-hidden />
          <span className="truncate">
            <span className="sr-only">{t("teams.table.captain")}: </span>
            {tm.captain.name}
          </span>
        </span>
      ) : (
        tm.status !== "ARCHIVED" && <span className="mt-0.5 block font-medium text-warning">{t("teams.table.noCaptain")}</span>
      )}
    </span>
  );
  const nameCell = (tm: TeamRow) => (
    <span className="block min-w-0">
      <Link href={href({ team: tm.id })} scroll={false} className="font-medium hover:text-primary hover:underline" aria-current={tm.id === focus?.id ? "true" : undefined}>
        {tm.name}
      </Link>
      <span className="block truncate text-xs text-muted-foreground">
        {multiUni && `${tm.university.shortName} · `}
        {tm.faculty?.name ?? t("teams.table.noFaculty")}
      </span>
    </span>
  );
  const actions = (tm: TeamRow, compact: boolean) => {
    const { eligible } = readiness(tm);
    return (
      <div className={cn("flex items-center justify-end gap-1", compact ? "flex-nowrap" : "flex-wrap")}>
        {eligible && <CreateApplicationDialog team={toApp(tm)} note={note} compact={compact} />}
        <TeamRowActions team={toForm(tm)} applications={tm.applications.length} />
      </div>
    );
  };

  return (
    <TeamOptionsProvider value={options}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("teams.stats.total")} value={nonArchived.length} icon={Users} hint={t("teams.stats.totalHint", { active: activeN, forming: formingN })} />
          <StatCard label={t("teams.stats.ready")} value={readyN} icon={ShieldCheck} tone="success" hint={t("teams.stats.readyHint")} />
          <StatCard label={t("teams.stats.applied")} value={appliedN} icon={FileCheck2} tone="info" hint={t("teams.stats.appliedHint")} />
          <StatCard
            label={t("teams.stats.seeking")}
            value={seeking}
            icon={UserRoundSearch}
            tone="warning"
            hint={<Link href="/academy/students?status=SEEKING_TEAM" className="text-primary hover:underline">{t("teams.stats.seekingHint")}</Link>}
          />
        </div>

        {focusId && !focus && (
          <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground" role="status">{t("teams.detail.notFound")}</p>
        )}
        {focus && renderDetail(focus, href({ team: undefined }))}

        <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="teams-list-title">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-baseline gap-3">
              <h2 id="teams-list-title" className="text-sm font-semibold">{t("teams.table.title")}</h2>
              <span className="tabular text-xs text-muted-foreground" aria-live="polite">{t("teams.table.results", { count: listed.length })}</span>
            </div>
            <TeamFormDialog mode="create" />
          </div>
          <FilterBar
            action={BASE}
            variant="inline"
            className="pt-0"
            keep={{ team: focus?.id }}
            search={{ label: tc("filters.search"), placeholder: t("teams.filters.qPlaceholder"), value: q }}
            selects={[
              {
                name: "status",
                label: t("filters.status"),
                allLabel: t("teams.filters.active"),
                value: status === "active" ? "" : status,
                options: [...TEAM_STATUSES.map((s) => ({ value: s, label: te(`TeamStatus.${s}`) })), { value: "all", label: t("teams.filters.all") }],
              },
              ...(multiUni
                ? [{
                    name: "university",
                    label: t("filters.university"),
                    allLabel: t("filters.anyUniversity"),
                    value: uniFilter ?? "",
                    options: universities.filter((u) => teamUnis.has(u.id)).map((u) => ({ value: u.id, label: u.label })),
                  }]
                : []),
              {
                name: "faculty",
                label: t("filters.faculty"),
                allLabel: t("filters.anyFaculty"),
                value: facultyFilter ?? "",
                wide: true,
                options: [...facultyChoices.map((f) => ({ value: f.id, label: f.name })), { value: "none", label: t("filters.noFaculty") }],
              },
            ]}
          />

          {listed.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filtered ? t("teams.empty.filtered") : t("teams.empty.title")}
              description={filtered ? t("teams.empty.filteredHint") : t("teams.empty.hint")}
              className="m-4"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("teams.table.team")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("teams.table.mentor")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("teams.table.competition")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("teams.table.members")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("teams.table.status")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("teams.table.application")}</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground">{t("teams.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listed.map((tm) => (
                      <TableRow
                        key={tm.id}
                        id={`team-${tm.id}`}
                        className={cn("align-top hover:bg-muted/50", tm.status === "ARCHIVED" && "text-muted-foreground", tm.id === focus?.id && "bg-accent/50 hover:bg-accent/60")}
                      >
                        <TableCell className="max-w-60 min-w-48 pl-4 whitespace-normal">{nameCell(tm)}</TableCell>
                        <TableCell className="max-w-44">{mentorCell(tm)}</TableCell>
                        <TableCell className="max-w-56 min-w-40 text-xs whitespace-normal">
                          {tm.competition ? <span className="line-clamp-2">{tm.competition.name}</span> : <span className="text-muted-foreground">{t("teams.table.noCompetition")}</span>}
                        </TableCell>
                        <TableCell className="max-w-44">{membersCell(tm)}</TableCell>
                        <TableCell><EnumBadge enumName="TeamStatus" value={tm.status} /></TableCell>
                        <TableCell>{latestApp(tm)}</TableCell>
                        <TableCell className="pr-4 text-right">{actions(tm, true)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="divide-y xl:hidden">
                {listed.map((tm) => (
                  <li key={tm.id} className={cn("space-y-3 p-4", tm.status === "ARCHIVED" && "text-muted-foreground", tm.id === focus?.id && "bg-accent/50")}>
                    <div className="flex items-start justify-between gap-3">
                      {nameCell(tm)}
                      <EnumBadge enumName="TeamStatus" value={tm.status} className="shrink-0" />
                    </div>
                    <dl className="grid grid-cols-1 gap-3 text-xs min-[420px]:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("teams.table.mentor")}</dt>
                        <dd className="mt-1">{mentorCell(tm)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("teams.table.members")}</dt>
                        <dd className="mt-1">{membersCell(tm)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("teams.table.competition")}</dt>
                        <dd className="mt-1 text-pretty">{tm.competition?.name ?? <span className="text-muted-foreground">{t("teams.table.noCompetition")}</span>}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("teams.table.application")}</dt>
                        <dd className="mt-1">{latestApp(tm)}</dd>
                      </div>
                    </dl>
                    <div className="-mr-2">{actions(tm, false)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </TeamOptionsProvider>
  );

  // ----- detail panel (?team=<id>) -----
  function renderDetail(tm: TeamRow, closeHref: string) {
    const { checks, eligible } = readiness(tm);
    const checkKeys = ["active", "competition", "captain", "members", "noOpen"] as const;
    return (
      <section className="rounded-xl border border-primary/30 bg-card shadow-card" aria-labelledby="team-detail-title" id="team-detail">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-primary">{t("teams.detail.eyebrow")}</p>
            <h2 id="team-detail-title" className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {tm.name}
              <EnumBadge enumName="TeamStatus" value={tm.status} />
            </h2>
            <p className="text-xs text-muted-foreground">
              {tm.university.shortName} · {tm.faculty?.name ?? t("teams.table.noFaculty")} · {t("teams.detail.created", { date: fmtDate(tm.createdAt, locale) })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {eligible && <CreateApplicationDialog team={toApp(tm)} note={note} compact />}
            <TeamRowActions team={toForm(tm)} applications={tm.applications.length} />
            <Button variant="ghost" size="icon-sm" className="size-8 text-muted-foreground" nativeButton={false} render={<Link href={closeHref} scroll={false} aria-label={t("teams.detail.close")} />}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <div className="grid gap-6 p-4 lg:grid-cols-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("teams.detail.members", { count: tm.members.length })}</h3>
            {tm.members.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("teams.detail.noMembers")}</p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {tm.members.map((m) => (
                  <li key={m.id} className="flex items-start gap-2.5">
                    <UserAvatar name={m.name} size="sm" />
                    <div className="min-w-0 text-sm">
                      <p className="flex flex-wrap items-center gap-x-1.5 font-medium">
                        {m.name}
                        {tm.captainId === m.id && (
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-warning">
                            <Crown className="size-3" aria-hidden />
                            {t("teams.table.captain")}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      {(m.skills || m.faculty) && <p className="text-xs text-pretty text-muted-foreground">{[m.faculty?.name, m.skills].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">{t("teams.detail.readiness")}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {checkKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    {checks[k] ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className={cn(!checks[k] && "text-muted-foreground")}>
                      <span className="sr-only">{checks[k] ? t("teams.detail.met") : t("teams.detail.notMet")}: </span>
                      {t(`teams.detail.check.${k}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{eligible ? t("teams.detail.readyHint") : t("teams.detail.notReadyHint")}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t("teams.table.mentor")}</dt>
                  <dd className="font-medium">{tm.mentor?.name ?? t("teams.table.noMentor")}</dd>
                </div>
              </div>
              <div className="flex gap-2">
                <Trophy className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t("teams.table.competition")}</dt>
                  <dd className="font-medium text-pretty">{tm.competition?.name ?? t("teams.table.noCompetition")}</dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">{t("teams.detail.applications")}</h3>
              {tm.applications.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("teams.table.noApplication")}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {tm.applications.map((ap) => (
                    <li key={ap.id} className="flex items-start gap-2 text-sm">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/applications/${ap.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{ap.code}</Link>
                          <EnumBadge enumName="ApplicationStatus" value={ap.status} />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{ap.projectTitle} · {fmtDate(ap.submittedAt, locale)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {tm.notes && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">{t("teams.form.notes")}</h3>
                <p className="mt-1.5 text-sm text-pretty whitespace-pre-line">{tm.notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
}
