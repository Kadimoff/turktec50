import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, ClipboardCheck, FileStack, Hourglass, PenLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weightedScore } from "@/lib/kpi";
import { CATEGORIES, KPI_TARGETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { HumanControlNote } from "@/components/shared/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlFilters } from "@/components/projects/url-filters";
import { Pagination } from "@/components/projects/pagination";
import { hrefWith, PAGE_SIZE, spEnum, spPage, spValue } from "@/components/projects/url";
import type { Tone } from "@/lib/tones";

export async function generateMetadata() {
  const t = await getTranslations("applications");
  return { title: t("title") };
}

const STATUSES = Object.values(ApplicationStatus);
const OPEN_STATUSES: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  const user = await requireUser(["ADMIN", "JURY"]);
  const isJury = user.role === "JURY";
  const sp = await props.searchParams;
  const status = spEnum(sp, "status", STATUSES);
  const category = spEnum(sp, "category", CATEGORIES);
  const university = spValue(sp, "university");
  const q = spValue(sp, "q");
  const mine = isJury ? spEnum(sp, "mine", ["todo"] as const) : undefined;
  const page = spPage(sp);

  const where: Prisma.ApplicationWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
    ...(university && { universityId: university }),
    ...(q && {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { teamName: { contains: q, mode: "insensitive" } },
        { projectTitle: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(mine === "todo" && {
      status: { in: OPEN_STATUSES },
      evaluations: { none: { evaluatorId: user.id, status: "SUBMITTED" } },
    }),
  };

  const [t, tc, te] = await Promise.all([getTranslations("applications"), getTranslations("common"), getTranslations("enums")]);

  const [byStatus, evaluatedCount, total, rows, universities, rubric, myTodo, mySubmitted] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.application.count({ where: { evaluations: { some: { status: "SUBMITTED" } } } }),
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: [{ status: "asc" }, { code: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, code: true, teamName: true, projectTitle: true, category: true, status: true,
        university: { select: { shortName: true, name: true } },
        evaluations: {
          select: { evaluatorId: true, status: true, scores: { select: { criterionId: true, score: true } } },
        },
      },
    }),
    prisma.university.findMany({ where: { applications: { some: {} } }, orderBy: { shortName: "asc" }, select: { id: true, shortName: true } }),
    prisma.rubric.findUnique({ where: { kind: "SELECTION" }, select: { criteria: { select: { id: true, weight: true, maxScore: true } } } }),
    isJury
      ? prisma.application.count({ where: { status: { in: OPEN_STATUSES }, evaluations: { none: { evaluatorId: user.id, status: "SUBMITTED" } } } })
      : Promise.resolve(0),
    isJury ? prisma.evaluation.count({ where: { evaluatorId: user.id, applicationId: { not: null }, status: "SUBMITTED" } }) : Promise.resolve(0),
  ]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count._all ?? 0])) as Record<ApplicationStatus, number>;
  const allCount = STATUSES.reduce((a, s) => a + counts[s], 0);
  const criteria = rubric?.criteria ?? [];

  const items = rows.map((r) => {
    const submitted = r.evaluations.filter((e) => e.status === "SUBMITTED");
    const scores = submitted.map((e) => weightedScore(criteria, Object.fromEntries(e.scores.map((s) => [s.criterionId, s.score]))));
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    const myEval = r.evaluations.find((e) => e.evaluatorId === user.id);
    const my: "none" | "draft" | "submitted" = !myEval ? "none" : myEval.status === "SUBMITTED" ? "submitted" : "draft";
    return { ...r, submittedCount: submitted.length, avg, my };
  });

  const params = { status, category, university, q, mine };
  const myTone: Record<string, Tone> = { none: "neutral", draft: "warning", submitted: "success" };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <HumanControlNote />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("stats.total")} value={allCount} icon={FileStack} tone="info" hint={t("stats.totalHint")} />
        <StatCard
          label={t("stats.evaluated")}
          value={evaluatedCount}
          icon={ClipboardCheck}
          tone="brand"
          target={KPI_TARGETS.applicationsEvaluated}
          current={evaluatedCount}
          hint={t("stats.evaluatedHint", { target: KPI_TARGETS.applicationsEvaluated })}
        />
        <StatCard label={t("stats.underReview")} value={counts.SUBMITTED + counts.UNDER_REVIEW} icon={Hourglass} tone="warning" hint={t("stats.underReviewHint")} />
        {isJury ? (
          <StatCard
            label={t("stats.myTodo")}
            value={myTodo}
            icon={PenLine}
            tone={myTodo > 0 ? "warning" : "success"}
            hint={t("stats.mySubmitted", { count: mySubmitted })}
          />
        ) : (
          <StatCard
            label={t("stats.accepted")}
            value={counts.ACCEPTED}
            icon={CheckCircle2}
            tone="success"
            hint={t("stats.acceptedHint", { waitlist: counts.WAITLIST, rejected: counts.REJECTED })}
          />
        )}
      </div>

      <nav aria-label={t("filters.status")} className="-mx-1 flex flex-wrap gap-2 px-1">
        <StatusChip href={hrefWith("/applications", { ...params, status: undefined, mine: undefined })} active={!status && !mine} label={tc("actions.all")} count={allCount} />
        {STATUSES.map((s) => (
          <StatusChip
            key={s}
            href={hrefWith("/applications", { ...params, status: s, mine: undefined })}
            active={status === s && !mine}
            label={te(`ApplicationStatus.${s}`)}
            count={counts[s]}
          />
        ))}
        {isJury && (
          <StatusChip
            href={hrefWith("/applications", { ...params, status: undefined, mine: "todo" })}
            active={mine === "todo"}
            label={t("filters.myTodo")}
            count={myTodo}
            emphasis
          />
        )}
      </nav>

      <UrlFilters
        search={{ label: tc("actions.search"), placeholder: t("filters.searchPlaceholder") }}
        resetLabel={tc("actions.clear")}
        filters={[
          { name: "category", label: t("filters.category"), allLabel: tc("actions.all"), options: CATEGORIES.map((c) => ({ value: c, label: tc(`categories.${c}`) })) },
          { name: "university", label: t("filters.university"), allLabel: tc("actions.all"), options: universities.map((u) => ({ value: u.id, label: u.shortName })) },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState title={tc("states.noResults")} description={t("empty")} />
      ) : (
        <section aria-label={t("listLabel")} className="space-y-4">
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("table.code")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.team")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.university")}</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-muted-foreground lg:table-cell">{t("table.category")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("table.evaluations")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-muted-foreground">
                    <span title={t("table.scoreHint")}>{t("table.score")}</span>
                  </TableHead>
                  {isJury && <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.myReview")}</TableHead>}
                  <TableHead className="pr-4 text-xs font-semibold text-muted-foreground">{t("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id} className="h-12">
                    <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{a.code}</TableCell>
                    <TableCell className="max-w-[22rem] whitespace-normal">
                      <Link
                        href={`/applications/${a.id}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {a.projectTitle}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{a.teamName}</p>
                    </TableCell>
                    <TableCell className="text-sm" title={a.university.name}>{a.university.shortName}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{tc(`categories.${a.category}` as never)}</TableCell>
                    <TableCell className="tabular text-right text-sm">{a.submittedCount}</TableCell>
                    <TableCell className="tabular text-right text-sm font-semibold">{a.avg !== null ? a.avg.toFixed(1) : <span className="text-muted-foreground">—</span>}</TableCell>
                    {isJury && (
                      <TableCell>
                        <ToneBadge tone={myTone[a.my]} dot={a.my !== "none"}>{t(`myReview.${a.my}`)}</ToneBadge>
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      <EnumBadge enumName="ApplicationStatus" value={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/applications/${a.id}`}
                  className="block rounded-xl border bg-card p-4 shadow-card transition-colors duration-150 hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">{a.code}</p>
                      <p className="truncate font-semibold">{a.projectTitle}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.teamName} · {a.university.shortName}</p>
                    </div>
                    <EnumBadge enumName="ApplicationStatus" value={a.status} />
                  </div>
                  <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex gap-1"><dt>{t("table.evaluations")}:</dt><dd className="tabular font-semibold text-foreground">{a.submittedCount}</dd></div>
                    <div className="flex gap-1"><dt>{t("table.score")}:</dt><dd className="tabular font-semibold text-foreground">{a.avg !== null ? a.avg.toFixed(1) : "—"}</dd></div>
                    {isJury && (
                      <div className="flex gap-1">
                        <dt className="sr-only">{t("table.myReview")}</dt>
                        <dd><ToneBadge tone={myTone[a.my]} dot={a.my !== "none"}>{t(`myReview.${a.my}`)}</ToneBadge></dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">{t("table.scoreHint")}</p>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} path="/applications" params={params} />
        </section>
      )}
    </div>
  );
}

function StatusChip({ href, active, label, count, emphasis }: { href: string; active: boolean; label: string; count: number; emphasis?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : emphasis
            ? "border-warning/40 bg-warning-soft text-warning hover:border-warning"
            : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
      <span className={cn("tabular rounded-full px-1.5 text-xs font-semibold", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
        {count}
      </span>
    </Link>
  );
}
