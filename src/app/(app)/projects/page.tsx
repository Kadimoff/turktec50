import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { readinessFromChecklist } from "@/lib/kpi";
import { CATEGORIES, STAGE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/progress-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlFilters } from "@/components/projects/url-filters";
import { Pagination } from "@/components/projects/pagination";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { hrefWith, PAGE_SIZE, spEnum, spPage, spValue } from "@/components/projects/url";

export async function generateMetadata() {
  const t = await getTranslations("projects");
  return { title: t("title") };
}

const HEALTHS = ["ON_TRACK", "WATCH", "AT_RISK"] as const;
const SORTS = ["code", "readiness", "overdue"] as const;

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await requireUser();
  if (user.role === "TEAM") {
    const m = await prisma.projectMember.findFirst({ where: { userId: user.id }, select: { projectId: true } });
    if (m) redirect(`/projects/${m.projectId}`);
    const tt = await getTranslations("projects");
    return (
      <div className="space-y-6">
        <PageHeader title={tt("title")} />
        <EmptyState icon={FolderKanban} title={tt("team.noProject")} description={tt("team.noProjectHint")} />
      </div>
    );
  }
  const isAdmin = user.role === "ADMIN";
  const sp = await props.searchParams;
  const stage = spEnum(sp, "stage", STAGE_ORDER);
  const health = spEnum(sp, "health", HEALTHS);
  const category = spEnum(sp, "category", CATEGORIES);
  const university = spValue(sp, "university");
  const q = spValue(sp, "q");
  const sort = spEnum(sp, "sort", SORTS) ?? "code";
  const page = spPage(sp);

  const scope = projectScope(user);
  const base: Prisma.ProjectWhereInput = {
    AND: [
      scope,
      {
        ...(health && { health }),
        ...(category && { category }),
        ...(university && { universityId: university }),
        ...(q && {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
    ],
  };
  const where: Prisma.ProjectWhereInput = stage ? { AND: [base, { stage }] } : base;
  const now = new Date();

  const [t, tc, te] = await Promise.all([getTranslations("projects"), getTranslations("common"), getTranslations("enums")]);

  const [stageCounts, rows, universities, scopeTotal, competitions, allUniversities] = await Promise.all([
    prisma.project.groupBy({ by: ["stage"], where: base, _count: { _all: true } }),
    prisma.project.findMany({
      where,
      select: {
        id: true, code: true, title: true, tagline: true, stage: true, health: true, category: true,
        competition: { select: { name: true } },
        university: { select: { shortName: true } },
        members: { where: { isLead: true }, take: 1, select: { user: { select: { name: true } } } },
        mentors: { orderBy: { createdAt: "asc" }, select: { focus: true, mentor: { select: { name: true } } } },
        checklist: { select: { required: true, status: true } },
      },
    }),
    prisma.university.findMany({ where: { projects: { some: scope } }, orderBy: { shortName: "asc" }, select: { id: true, shortName: true } }),
    prisma.project.count({ where: scope }),
    isAdmin ? prisma.competition.findMany({ orderBy: { applicationDeadline: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    isAdmin ? prisma.university.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true } }) : Promise.resolve([]),
  ]);

  const ids = rows.map((r) => r.id);
  const [openTasks, overdueTasks] = ids.length
    ? await Promise.all([
        prisma.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: { not: "DONE" } }, _count: { _all: true } }),
        prisma.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: { not: "DONE" }, dueDate: { lt: now } }, _count: { _all: true } }),
      ])
    : [[], []];
  const openMap = new Map(openTasks.map((r) => [r.projectId, r._count._all]));
  const overdueMap = new Map(overdueTasks.map((r) => [r.projectId, r._count._all]));

  const all = rows.map((r) => ({
    ...r,
    readiness: readinessFromChecklist(r.checklist),
    open: openMap.get(r.id) ?? 0,
    overdue: overdueMap.get(r.id) ?? 0,
    lead: r.members[0]?.user.name ?? null,
  }));
  all.sort((a, b) =>
    sort === "readiness" ? b.readiness - a.readiness || a.code.localeCompare(b.code)
    : sort === "overdue" ? b.overdue - a.overdue || a.code.localeCompare(b.code)
    : a.code.localeCompare(b.code),
  );
  const total = all.length;
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const countFor = (s: string) => stageCounts.find((c) => c.stage === s)?._count._all ?? 0;
  const baseTotal = stageCounts.reduce((a, c) => a + c._count._all, 0);
  const params = { stage, health, category, university, q, sort: sort === "code" ? undefined : sort };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t(`eyebrow.${user.role}`)}
        title={t("title")}
        description={t(`description.${user.role}`, { count: scopeTotal })}
        actions={
          isAdmin ? (
            <NewProjectDialog
              categories={CATEGORIES.map((c) => ({ value: c, label: tc(`categories.${c}`) }))}
              universities={allUniversities.map((u) => ({ value: u.id, label: `${u.shortName} — ${u.name}` }))}
              competitions={competitions.map((c) => ({ value: c.id, label: c.name }))}
            />
          ) : undefined
        }
      />

      {/* stage strip */}
      <nav aria-label={t("stageStrip")} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StageLink href={hrefWith("/projects", { ...params, stage: undefined })} active={!stage} label={tc("actions.all")} count={baseTotal} />
        {STAGE_ORDER.map((s) => (
          <StageLink key={s} href={hrefWith("/projects", { ...params, stage: s })} active={stage === s} label={te(`ProjectStage.${s}`)} count={countFor(s)} />
        ))}
      </nav>

      <UrlFilters
        search={{ label: tc("actions.search"), placeholder: t("filters.searchPlaceholder") }}
        resetLabel={tc("actions.clear")}
        filters={[
          { name: "health", label: t("filters.health"), allLabel: tc("actions.all"), options: HEALTHS.map((h) => ({ value: h, label: te(`ProjectHealth.${h}`) })) },
          { name: "category", label: t("filters.category"), allLabel: tc("actions.all"), options: CATEGORIES.map((c) => ({ value: c, label: tc(`categories.${c}`) })) },
          { name: "university", label: t("filters.university"), allLabel: tc("actions.all"), options: universities.map((u) => ({ value: u.id, label: u.shortName })) },
          { name: "sort", label: t("filters.sort"), defaultValue: "code", options: SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) })) },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={scopeTotal === 0 ? t("empty.none") : t("empty.filtered")}
          description={scopeTotal === 0 ? t(`empty.noneHint.${user.role}`) : t("empty.filteredHint")}
        />
      ) : (
        <section aria-label={t("listLabel")} className="space-y-4">
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("table.project")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.lead")}</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-muted-foreground xl:table-cell">{t("table.mentors")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.stage")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.readiness")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("table.tasks")}</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.health")}</TableHead>
                  <TableHead className="hidden pr-4 text-xs font-semibold text-muted-foreground 2xl:table-cell">{t("table.competition")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="h-14">
                    <TableCell className="max-w-[20rem] min-w-[13rem] pl-4 whitespace-normal">
                      <Link
                        href={`/projects/${p.id}`}
                        className="group/link block rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>{" "}
                        <span className="font-semibold text-foreground group-hover/link:text-primary group-hover/link:underline">{p.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.tagline}</span>
                        {p.competition && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80 2xl:hidden">{p.competition.name}</span>}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.lead ? (
                        <span className="flex items-center gap-2 text-sm">
                          <UserAvatar name={p.lead} size="sm" />
                          <span className="max-w-[9rem] truncate">{p.lead}</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {p.mentors.length ? (
                        <ul className="space-y-0.5 text-xs">
                          {p.mentors.map((m) => (
                            <li key={m.mentor.name} className="max-w-[11rem] truncate" title={m.focus ? `${m.mentor.name} · ${m.focus}` : m.mentor.name}>{m.mentor.name}</li>
                          ))}
                        </ul>
                      ) : <span className="text-xs text-muted-foreground">{t("table.noMentor")}</span>}
                    </TableCell>
                    <TableCell><EnumBadge enumName="ProjectStage" value={p.stage} /></TableCell>
                    <TableCell className="w-36"><ProgressBar value={p.readiness} label={t("table.readinessOf", { title: p.title })} /></TableCell>
                    <TableCell className="tabular text-right text-sm">
                      <span>{p.open}</span>
                      {p.overdue > 0 ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-danger">
                          <AlertTriangle className="size-3" aria-hidden />
                          {t("table.overdue", { count: p.overdue })}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell><EnumBadge enumName="ProjectHealth" value={p.health} /></TableCell>
                    <TableCell className="hidden max-w-[13rem] pr-4 text-xs whitespace-normal text-muted-foreground 2xl:table-cell">{p.competition?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-xl border bg-card p-4 shadow-card transition-colors duration-150 hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">{p.code} · {p.university.shortName}</p>
                      <p className="truncate font-semibold">{p.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.tagline}</p>
                    </div>
                    <EnumBadge enumName="ProjectHealth" value={p.health} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EnumBadge enumName="ProjectStage" value={p.stage} />
                    <span className="tabular text-xs text-muted-foreground">
                      {t("card.tasks", { count: p.open })}
                      {p.overdue > 0 && <span className="font-semibold text-danger"> · {t("table.overdue", { count: p.overdue })}</span>}
                    </span>
                  </div>
                  <ProgressBar value={p.readiness} label={t("table.readinessOf", { title: p.title })} className="mt-3" />
                  {p.lead && <p className="mt-2 truncate text-xs text-muted-foreground">{t("table.lead")}: {p.lead}</p>}
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} path="/projects" params={params} />
        </section>
      )}
    </div>
  );
}

function StageLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-16 flex-col justify-between rounded-xl border bg-card px-3 py-2.5 shadow-card transition-colors duration-150",
        "hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "border-primary bg-accent ring-1 ring-primary",
      )}
    >
      <span className={cn("truncate text-xs font-medium text-muted-foreground", active && "text-accent-foreground")}>{label}</span>
      <span className="tabular text-xl font-bold leading-tight">{count}</span>
    </Link>
  );
}
