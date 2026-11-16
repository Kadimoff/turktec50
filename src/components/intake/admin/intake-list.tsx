import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Archive, CircleCheck, Crown, Eye, Inbox, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { IntakeStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtRelative } from "@/lib/format";
import { buildHref, parsePage, pick, str, type SearchParams } from "@/lib/search-params";
import { matchesQuery } from "@/lib/search";
import { INTAKE_STATUSES, OPEN_INTAKE_STATUSES } from "@/components/intake/shared";
import { checkSelect, computeIntakeChecks } from "./checks";
import { publicApplyUrl } from "./server";
import { PublicLinkBox } from "./public-link";
import type { IntakeChecks } from "./types";

const BASE = "/academy/intake";
const PAGE_SIZE = 25;
const STATUS_FILTERS = ["open", ...INTAKE_STATUSES, "closed", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const CLOSED: IntakeStatus[] = ["REJECTED", "WITHDRAWN"];
const ORDER: Record<IntakeStatus, number> = { SUBMITTED: 0, UNDER_REVIEW: 1, NEEDS_CHANGES: 2, ACCEPTED: 3, REJECTED: 4, WITHDRAWN: 5 };
const isOpen = (s: IntakeStatus) => (OPEN_INTAKE_STATUSES as readonly string[]).includes(s);

function statusWhere(s: StatusFilter): Prisma.IntakeRequestWhereInput["status"] {
  if (s === "all") return undefined;
  if (s === "open") return { in: [...OPEN_INTAKE_STATUSES] };
  if (s === "closed") return { in: CLOSED };
  return s;
}

const listSelect = {
  ...checkSelect,
  code: true,
  status: true,
  submittedAt: true,
  subcategory: true,
  university: { select: { shortName: true } },
  competition: { select: { id: true, name: true, catalogId: true, ruleStatus: true } },
  members: {
    select: { id: true, name: true, email: true, isCaptain: true, facultyId: true, faculty: { select: { name: true, status: true, universityId: true } } },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.IntakeRequestSelect;
type Row = Prisma.IntakeRequestGetPayload<{ select: typeof listSelect }>;

/** Preparation requests (ADMIN): status counters, public link, filters (URL params), table ≥ xl and stacked cards below. */
export async function IntakeList({ searchParams: sp }: { searchParams: SearchParams }) {
  const [t, te, locale, applyUrl] = await Promise.all([getTranslations("intakeAdmin"), getTranslations("enums"), getLocale(), publicApplyUrl()]);

  const q = str(sp.q, 80) ?? "";
  const status: StatusFilter = pick(sp.status, STATUS_FILTERS, "open");
  const compParam = str(sp.competition, 40);
  const facParam = str(sp.faculty, 40);
  const pageParam = parsePage(sp.page);

  const [groups, competitions, faculties] = await Promise.all([
    prisma.intakeRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.competition.findMany({ where: { intakeRequests: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.faculty.findMany({ where: { intakeRequests: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const competition = compParam && competitions.some((c) => c.id === compParam) ? compParam : undefined;
  const faculty = facParam && (facParam === "none" || faculties.some((f) => f.id === facParam)) ? facParam : undefined;

  const rows = await prisma.intakeRequest.findMany({
    where: {
      status: statusWhere(status),
      ...(competition && { competitionId: competition }),
      ...(faculty && { facultyId: faculty === "none" ? null : faculty }),
    },
    select: listSelect,
    orderBy: { submittedAt: "desc" },
  });
  const multiUni = new Set(rows.map((r) => r.universityId)).size > 1;
  const captainOf = (r: Row) => r.members.find((m) => m.isCaptain) ?? r.members[0];
  const listed = rows
    .filter((r) => matchesQuery(q, r.code, r.teamName, captainOf(r)?.name, captainOf(r)?.email))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.submittedAt.getTime() - a.submittedAt.getTime());
  const pages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const page = Math.min(pageParam, pages);
  const shown = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const checks = await computeIntakeChecks(prisma, shown.filter((r) => isOpen(r.status)));

  const count = (s: IntakeStatus[]) => groups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  const total = count([...INTAKE_STATUSES]);
  const tiles: { key: string; filter: StatusFilter; icon: LucideIcon; tone: Tone; value: number; className?: string }[] = [
    { key: "new", filter: "SUBMITTED", icon: Sparkles, tone: "info", value: count(["SUBMITTED"]), className: "col-span-2 md:col-span-2 xl:col-span-1" },
    { key: "review", filter: "UNDER_REVIEW", icon: Eye, tone: "brand", value: count(["UNDER_REVIEW"]) },
    { key: "changes", filter: "NEEDS_CHANGES", icon: RotateCcw, tone: "warning", value: count(["NEEDS_CHANGES"]) },
    { key: "accepted", filter: "ACCEPTED", icon: CircleCheck, tone: "success", value: count(["ACCEPTED"]) },
    { key: "closed", filter: "closed", icon: Archive, tone: "neutral", value: count(CLOSED) },
  ];

  const params = { q: q || undefined, status: status === "open" ? undefined : status, competition, faculty };
  const filtered = !!(q || status !== "open" || competition || faculty);

  const checkBadge = (r: Row) => {
    const c: IntakeChecks | undefined = checks.get(r.id);
    if (!c) return <span className="text-xs text-muted-foreground" title={t("list.notChecked")}>—<span className="sr-only">{t("list.notChecked")}</span></span>;
    if (c.blocking > 0) return <ToneBadge tone="danger">{t("list.conflicts", { count: c.blocking })}</ToneBadge>;
    if (c.warnings > 0) return <ToneBadge tone="warning">{t("list.warnings", { count: c.warnings })}</ToneBadge>;
    return <ToneBadge tone="success">{t("list.noConflicts")}</ToneBadge>;
  };
  const detail = (r: Row) => `${BASE}/${r.id}`;
  const codeCell = (r: Row) => (
    <Link href={detail(r)} className="block w-fit font-mono text-xs font-semibold text-primary hover:underline">{r.code}</Link>
  );
  const teamCell = (r: Row) => (
    <span className="block min-w-0">
      <Link href={detail(r)} className="font-medium text-pretty hover:text-primary hover:underline">{r.teamName}</Link>
      <span className="block truncate text-xs text-muted-foreground">
        {multiUni && `${r.university.shortName} · `}
        {r.faculty?.name ?? t("list.noFaculty")}
      </span>
    </span>
  );
  const captainCell = (r: Row) => {
    const c = captainOf(r);
    if (!c) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <span className="block min-w-0 text-xs">
        <span className="flex items-center gap-1 font-medium">
          <Crown className="size-3 shrink-0 text-warning" aria-hidden />
          <span className="truncate">{c.name}</span>
        </span>
        <span className="block truncate text-muted-foreground">{c.email}</span>
      </span>
    );
  };
  const competitionCell = (r: Row) => (
    <span className="block min-w-0 text-xs">
      <span className="line-clamp-2 text-pretty">{r.competition.name}</span>
      <span className="block text-muted-foreground">{r.subcategory ?? t("list.noSubcategory")}</span>
    </span>
  );
  const dateCell = (r: Row) => (
    <span className="block text-xs">
      <span className="tabular block">{fmtDate(r.submittedAt, locale)}</span>
      <span className="block text-muted-foreground">{fmtRelative(r.submittedAt, locale)}</span>
    </span>
  );

  return (
    <div className="space-y-6">
      <section aria-labelledby="intake-stats-title">
        <h2 id="intake-stats-title" className="sr-only">{t("stats.title")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map((x) => (
            <li key={x.key} className={cn("min-w-0", x.className)}>
              <Link
                href={buildHref(BASE, { ...params, page: undefined }, { status: x.filter === "open" ? undefined : x.filter })}
                scroll={false}
                aria-current={status === x.filter ? "true" : undefined}
                className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <StatCard
                  className={cn("h-full transition-colors group-hover:border-primary/40", status === x.filter && "border-primary/50")}
                  label={t(`stats.${x.key}`)}
                  value={x.value}
                  icon={x.icon}
                  tone={x.tone}
                  hint={t(`stats.${x.key}Hint`, { total })}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PublicLinkBox url={applyUrl} />

      <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="intake-list-title">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-4">
          <h2 id="intake-list-title" className="text-sm font-semibold">{t("list.title")}</h2>
          <span className="tabular text-xs text-muted-foreground" aria-live="polite">{t("list.results", { count: listed.length })}</span>
        </div>
        <FilterBar
          action={BASE}
          variant="inline"
          search={{ label: t("filters.q"), placeholder: t("filters.qPlaceholder"), value: q }}
          selects={[
            {
              name: "status", label: t("filters.status"), allLabel: t("filters.open"), value: status === "open" ? "" : status, wide: true,
              options: [
                ...INTAKE_STATUSES.map((x) => ({ value: x, label: te(`IntakeStatus.${x}`) })),
                { value: "closed", label: t("filters.closed") },
                { value: "all", label: t("filters.all") },
              ],
            },
            {
              name: "competition", label: t("filters.competition"), allLabel: t("filters.anyCompetition"), value: competition, wide: true,
              options: competitions.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              name: "faculty", label: t("filters.faculty"), allLabel: t("filters.anyFaculty"), value: faculty, wide: true,
              options: [...faculties.map((f) => ({ value: f.id, label: f.name })), { value: "none", label: t("filters.noFaculty") }],
            },
          ]}
        />

        {listed.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={total === 0 ? t("empty.title") : filtered ? t("empty.filtered") : t("empty.noOpen")}
            description={total === 0 ? t("empty.hint") : filtered ? t("empty.filteredHint") : t("empty.noOpenHint")}
            className="m-4"
          />
        ) : (
          <>
            <div className="hidden xl:block">
              <Table className="min-w-[940px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("list.request")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("list.captain")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("list.competition")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("list.members")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("list.submitted")}</TableHead>
                    <TableHead className="pr-4 text-xs font-semibold text-muted-foreground">{t("list.statusChecks")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.id} className={cn("align-top hover:bg-muted/50", !isOpen(r.status) && "text-muted-foreground")}>
                      <TableCell className="max-w-56 min-w-44 pl-4 whitespace-normal">
                        {codeCell(r)}
                        {teamCell(r)}
                      </TableCell>
                      <TableCell className="max-w-52 min-w-40">{captainCell(r)}</TableCell>
                      <TableCell className="max-w-64 min-w-44 whitespace-normal">{competitionCell(r)}</TableCell>
                      <TableCell className="tabular text-right text-xs">{r.members.length}</TableCell>
                      <TableCell className="w-28 whitespace-normal">{dateCell(r)}</TableCell>
                      <TableCell className="pr-4">
                        <span className="flex flex-col items-start gap-1.5">
                          <EnumBadge enumName="IntakeStatus" value={r.status} />
                          {checks.has(r.id) && checkBadge(r)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y xl:hidden">
              {shown.map((r) => (
                <li key={r.id} className={cn("space-y-3 p-4", !isOpen(r.status) && "text-muted-foreground")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {codeCell(r)}
                      {teamCell(r)}
                    </div>
                    <EnumBadge enumName="IntakeStatus" value={r.status} className="shrink-0" />
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-xs min-[420px]:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="font-semibold text-muted-foreground">{t("list.captain")}</dt>
                      <dd className="mt-1">{captainCell(r)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-semibold text-muted-foreground">{t("list.competition")}</dt>
                      <dd className="mt-1">{competitionCell(r)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-semibold text-muted-foreground">{t("list.membersChecks")}</dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="tabular">{t("list.memberCount", { count: r.members.length })}</span>
                        {checkBadge(r)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-semibold text-muted-foreground">{t("list.submitted")}</dt>
                      <dd className="mt-1">{dateCell(r)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="border-t px-4 py-3">
              <Pagination basePath={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={listed.length} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
