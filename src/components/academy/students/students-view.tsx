import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Crown, GraduationCap, UserRoundSearch, Users, UserCheck, UserRoundPlus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { one, parsePage, pick, str, type SearchParams } from "@/lib/search-params";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentOptionsProvider } from "./student-options";
import { StudentFormDialog } from "./student-form-dialog";
import { StudentRowActions } from "./student-row-actions";
import { loadFacultyOptions, loadUniversityOptions } from "./server";
import type { StudentFormOptions, StudentFormValue } from "./types";

const BASE = "/academy/students";
const PAGE_SIZE = 25;
const STATUSES = ["CANDIDATE", "SEEKING_TEAM", "IN_TEAM", "ARCHIVED"] as const;
const STATUS_FILTERS = ["active", ...STATUSES, "all"] as const;

/** Student registry (ADMIN): stats, filters, desktop table + stacked cards, register / edit / delete dialogs. */
export async function StudentsView({ searchParams: sp }: { searchParams: SearchParams }) {
  const [t, te, tf] = await Promise.all([getTranslations("teams"), getTranslations("enums"), getTranslations("common.filters")]);

  const q = str(sp.q, 80) ?? "";
  const status = pick(sp.status, STATUS_FILTERS, "active");
  const facultyParam = one(sp.faculty) || undefined;
  const uniParam = one(sp.university) || undefined;
  const pageReq = parsePage(sp.page);

  const [{ universities, defaultUniversityId }, faculties, teams, grouped, uniCounts] = await Promise.all([
    loadUniversityOptions(),
    loadFacultyOptions(),
    prisma.team.findMany({ select: { id: true, name: true, universityId: true, status: true }, orderBy: { name: "asc" } }),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.student.groupBy({ by: ["universityId"], _count: { _all: true } }),
  ]);
  const count = (s: StudentStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const activeTotal = count("CANDIDATE") + count("SEEKING_TEAM") + count("IN_TEAM");
  const multiUni = uniCounts.length > 1;
  const facultyFilter = facultyParam && (facultyParam === "none" || faculties.some((f) => f.id === facultyParam)) ? facultyParam : undefined;
  const uniFilter = uniParam && universities.some((u) => u.id === uniParam) ? uniParam : undefined;

  const where: Prisma.StudentWhereInput = {
    ...(status === "active" ? { status: { not: "ARCHIVED" } } : status === "all" ? {} : { status }),
    ...(facultyFilter ? { facultyId: facultyFilter === "none" ? null : facultyFilter } : {}),
    ...(uniFilter ? { universityId: uniFilter } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q.toLowerCase() } },
            { skills: { contains: q, mode: "insensitive" } },
            { team: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const total = await prisma.student.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pageReq, pages);
  const rows = await prisma.student.findMany({
    where,
    orderBy: [{ name: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, name: true, email: true, universityId: true, facultyId: true, skills: true, notes: true, status: true, teamId: true,
      university: { select: { shortName: true } },
      faculty: { select: { name: true } },
      team: { select: { id: true, name: true, status: true } },
      captainOf: { select: { id: true } },
    },
  });

  const options: StudentFormOptions = {
    universities,
    defaultUniversityId,
    faculties,
    teams: teams.filter((tm) => tm.status !== "ARCHIVED"),
  };
  const facultyChoices = faculties.filter((f) => !uniFilter || f.universityId === uniFilter);
  const params = { q: q || undefined, status: status === "active" ? undefined : status, faculty: facultyFilter, university: uniFilter };
  const filtered = !!(q || status !== "active" || facultyFilter || uniFilter);

  const toForm = (r: (typeof rows)[number]): StudentFormValue => ({
    id: r.id,
    name: r.name,
    email: r.email,
    universityId: r.universityId,
    facultyId: r.facultyId,
    skills: r.skills,
    notes: r.notes,
    status: r.status,
    teamId: r.teamId,
    teamName: r.team?.name ?? null,
    isCaptain: !!r.captainOf && r.captainOf.id === r.teamId,
  });

  const teamCell = (r: (typeof rows)[number]) =>
    r.team ? (
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Link href={`/academy/teams?team=${r.team.id}`} className="truncate font-medium text-primary hover:underline">{r.team.name}</Link>
        {r.captainOf && r.captainOf.id === r.teamId && (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-warning">
            <Crown className="size-3" aria-hidden />
            {t("students.table.captain")}
          </span>
        )}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("students.table.noTeam")}</span>
    );
  const facultyLabel = (r: (typeof rows)[number]) => (
    <>
      {r.faculty?.name ?? <span className="text-muted-foreground">{t("students.table.noFaculty")}</span>}
      {multiUni && <span className="block text-2xs text-muted-foreground">{r.university.shortName}</span>}
    </>
  );

  return (
    <StudentOptionsProvider value={options}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("students.stats.total")} value={activeTotal} icon={GraduationCap} hint={t("students.stats.totalHint", { archived: count("ARCHIVED") })} />
          <StatCard label={t("students.stats.inTeam")} value={count("IN_TEAM")} icon={UserCheck} tone="success" hint={t("students.stats.inTeamHint")} />
          <StatCard label={t("students.stats.seeking")} value={count("SEEKING_TEAM")} icon={UserRoundSearch} tone="warning" hint={t("students.stats.seekingHint")} />
          <StatCard label={t("students.stats.candidates")} value={count("CANDIDATE")} icon={UserRoundPlus} tone="info" hint={t("students.stats.candidatesHint")} />
        </div>

        <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="students-list-title">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-baseline gap-3">
              <h2 id="students-list-title" className="text-sm font-semibold">{t("students.table.title")}</h2>
              <span className="tabular text-xs text-muted-foreground" aria-live="polite">{t("students.table.results", { count: total })}</span>
            </div>
            <StudentFormDialog mode="create" />
          </div>
          <FilterBar
            action={BASE}
            variant="inline"
            className="pt-0"
            search={{ label: tf("search"), placeholder: t("students.filters.qPlaceholder"), value: q }}
            selects={[
              {
                name: "status",
                label: t("filters.status"),
                allLabel: t("students.filters.active"),
                value: status === "active" ? "" : status,
                options: [...STATUSES.map((s) => ({ value: s, label: te(`StudentStatus.${s}`) })), { value: "all", label: t("students.filters.all") }],
              },
              ...(multiUni
                ? [{
                    name: "university",
                    label: t("filters.university"),
                    allLabel: t("filters.anyUniversity"),
                    value: uniFilter ?? "",
                    options: universities.filter((u) => uniCounts.some((c) => c.universityId === u.id)).map((u) => ({ value: u.id, label: u.label })),
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

          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filtered ? t("students.empty.filtered") : t("students.empty.title")}
              description={filtered ? t("students.empty.filteredHint") : t("students.empty.hint")}
              className="m-4"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("students.table.student")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("students.table.faculty")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("students.table.skills")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("students.table.team")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("students.table.status")}</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground">{t("students.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className={cn("hover:bg-muted/50", r.status === "ARCHIVED" && "text-muted-foreground")}>
                        <TableCell className="min-w-56 pl-4">
                          <span className="flex items-center gap-2.5">
                            <UserAvatar name={r.name} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{r.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-56 text-xs whitespace-normal">{facultyLabel(r)}</TableCell>
                        <TableCell className="max-w-48 text-xs whitespace-normal">
                          {r.skills ? <span className="line-clamp-2">{r.skills}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-48 text-xs">{teamCell(r)}</TableCell>
                        <TableCell><EnumBadge enumName="StudentStatus" value={r.status} /></TableCell>
                        <TableCell className="pr-4 text-right"><StudentRowActions student={toForm(r)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="divide-y lg:hidden">
                {rows.map((r) => (
                  <li key={r.id} className={cn("space-y-2.5 p-4", r.status === "ARCHIVED" && "text-muted-foreground")}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar name={r.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                        </span>
                      </span>
                      <EnumBadge enumName="StudentStatus" value={r.status} className="shrink-0" />
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("students.table.faculty")}</dt>
                        <dd className="mt-0.5 text-pretty">{facultyLabel(r)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("students.table.team")}</dt>
                        <dd className="mt-0.5">{teamCell(r)}</dd>
                      </div>
                      {r.skills && (
                        <div className="col-span-2 min-w-0">
                          <dt className="font-semibold text-muted-foreground">{t("students.table.skills")}</dt>
                          <dd className="mt-0.5 text-pretty">{r.skills}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="-mr-2 flex justify-end"><StudentRowActions student={toForm(r)} /></div>
                  </li>
                ))}
              </ul>
              <Pagination basePath={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </section>
      </div>
    </StudentOptionsProvider>
  );
}
