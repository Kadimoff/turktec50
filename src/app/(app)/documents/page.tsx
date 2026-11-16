import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle, ArrowRight, BadgeCheck, Clock, FileStack, FolderSearch, Gauge } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { readinessFromChecklist } from "@/lib/kpi";
import { fmtDate, fmtRelative } from "@/lib/format";
import { parsePage, pick, str } from "@/lib/search-params";
import { matchesQuery } from "@/lib/search";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ProgressBar } from "@/components/shared/progress-bar";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const STATUS = ["missing", "review", "rejected", "complete"] as const;
const SORTS = ["code", "readiness_asc", "readiness_desc", "recent"] as const;
const SORT_LABEL = { code: "sortCode", readiness_asc: "sortReadinessAsc", readiness_desc: "sortReadinessDesc", recent: "sortRecent" } as const;

export default async function DocumentsOverviewPage(props: PageProps<"/documents">) {
  const user = await requireUser(["ADMIN", "MENTOR", "TEAM"]);
  if (user.role === "TEAM") {
    const m = await prisma.projectMember.findFirst({ where: { userId: user.id }, select: { projectId: true } });
    if (m) redirect(`/projects/${m.projectId}/documents`);
    redirect("/dashboard");
  }

  const sp = await props.searchParams;
  const q = str(sp.q, 80) ?? "";
  const status = pick(sp.status, STATUS);
  const sort = pick(sp.sort, SORTS, "code");
  const pageReq = parsePage(sp.page);

  const scope = projectScope(user);
  const [projects, lastUploads, queue, t, locale] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, title: true, packageQcPassed: true, stage: true,
        university: { select: { shortName: true } },
        checklist: { select: { required: true, status: true } },
      },
    }),
    prisma.document.groupBy({ by: ["projectId"], where: { project: scope }, _max: { createdAt: true } }),
    prisma.checklistItem.findMany({
      where: { project: scope, status: { in: ["UPLOADED", "IN_REVIEW"] } },
      select: {
        id: true, key: true, title: true, status: true, projectId: true,
        project: { select: { code: true, title: true } },
        documents: { orderBy: { version: "desc" }, take: 1, select: { createdAt: true, uploadedBy: { select: { name: true } } } },
      },
    }),
    getTranslations("documents"),
    getLocale(),
  ]);

  const lastById = new Map(lastUploads.map((l) => [l.projectId, l._max.createdAt]));
  const rows = projects.map((p) => {
    const required = p.checklist.filter((c) => c.required);
    return {
      ...p,
      readiness: readinessFromChecklist(p.checklist),
      requiredCount: required.length,
      missing: required.filter((c) => c.status === "MISSING").length,
      awaiting: p.checklist.filter((c) => c.status === "UPLOADED" || c.status === "IN_REVIEW").length,
      rejected: p.checklist.filter((c) => c.status === "REJECTED").length,
      lastUpload: lastById.get(p.id) ?? null,
    };
  });

  // portfolio stats (whole scope, not filtered)
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.readiness, 0) / rows.length) : 0;
  const complete = rows.filter((r) => r.requiredCount > 0 && r.readiness === 100).length;
  const qc = rows.filter((r) => r.packageQcPassed).length;
  const rejectedItems = rows.reduce((a, r) => a + r.rejected, 0);
  const rejectedProjects = rows.filter((r) => r.rejected > 0).length;
  const sortedQueue = queue
    .map((i) => ({ ...i, uploadedAt: i.documents[0]?.createdAt ?? null }))
    .sort((a, b) => (a.uploadedAt?.getTime() ?? 0) - (b.uploadedAt?.getTime() ?? 0));
  const oldest = sortedQueue[0]?.uploadedAt;

  // filter + sort + paginate
  const filtered = rows
    .filter((r) => matchesQuery(q, r.title, r.code))
    .filter((r) =>
      status === "missing" ? r.missing > 0
        : status === "review" ? r.awaiting > 0
          : status === "rejected" ? r.rejected > 0
            : status === "complete" ? r.requiredCount > 0 && r.readiness === 100
              : true,
    )
    .sort((a, b) =>
      sort === "readiness_asc" ? a.readiness - b.readiness || a.code.localeCompare(b.code)
        : sort === "readiness_desc" ? b.readiness - a.readiness || a.code.localeCompare(b.code)
          : sort === "recent" ? (b.lastUpload?.getTime() ?? 0) - (a.lastUpload?.getTime() ?? 0)
            : a.code.localeCompare(b.code),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageReq, pages);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const itemLabel = (i: { key: string | null; title: string | null }) => (i.key ? t(`items.${i.key}.title` as never) : (i.title ?? "—"));
  const params = { q: q || undefined, status, sort: sort === "code" ? undefined : sort };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("overview.eyebrow")}
        title={t("overview.title")}
        description={user.role === "ADMIN" ? t("overview.descriptionAdmin") : t("overview.descriptionMentor")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("overview.avgReadiness")} value={`${avg}%`} icon={Gauge} tone="brand" target={100} current={avg} hint={t("overview.avgHint", { count: rows.length })} />
        <StatCard label={t("overview.fullyApproved")} value={complete} icon={BadgeCheck} tone="success" hint={t("overview.fullyHint", { qc })} />
        <StatCard
          label={t("overview.awaiting")}
          value={sortedQueue.length}
          icon={Clock}
          tone="warning"
          hint={oldest ? t("overview.awaitingHint", { when: fmtRelative(oldest, locale) }) : t("overview.queueEmpty")}
        />
        <StatCard label={t("overview.rejected")} value={rejectedItems} icon={AlertCircle} tone="danger" hint={t("overview.rejectedHint", { count: rejectedProjects })} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* readiness table */}
        <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="readiness-table-title">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
            <h2 id="readiness-table-title" className="text-sm font-semibold">{t("overview.tableTitle")}</h2>
            <span className="tabular text-xs text-muted-foreground">{t("overview.results", { count: filtered.length })}</span>
          </div>
          <FilterBar
            variant="inline"
            className="pt-3"
            action="/documents"
            search={{ label: t("filters.q"), placeholder: t("filters.qPlaceholder"), value: q }}
            selects={[
              { name: "status", label: t("filters.status"), allLabel: t("filters.all"), value: status, options: STATUS.map((s) => ({ value: s, label: t(`filters.${s}`) })) },
              { name: "sort", label: t("filters.sort"), value: sort, wide: true, options: SORTS.map((s) => ({ value: s, label: t(`filters.${SORT_LABEL[s]}`) })) },
            ]}
          />

          {pageRows.length === 0 ? (
            <EmptyState icon={FolderSearch} title={t("overview.empty")} description={t("overview.emptyHint")} className="m-4" />
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("overview.project")}</TableHead>
                      <TableHead className="w-44 text-xs font-semibold text-muted-foreground">{t("overview.readiness")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("overview.missing")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("overview.awaitingCol")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("overview.rejectedCol")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("overview.lastUpload")}</TableHead>
                      <TableHead className="pr-4"><span className="sr-only">{t("overview.project")}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell className="max-w-72 pl-4">
                          <Link href={`/projects/${r.id}/documents`} className="group block min-w-0 focus-visible:outline-none">
                            <span className="font-mono text-2xs font-semibold text-primary">{r.code}</span>
                            <span className="block truncate font-medium group-hover:text-primary group-hover:underline group-focus-visible:underline">{r.title}</span>
                            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                              {r.university.shortName}
                              {r.packageQcPassed && (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-success">
                                  <BadgeCheck className="size-3" aria-hidden />
                                  {t("overview.qc")}
                                </span>
                              )}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ProgressBar value={r.readiness} label={`${t("overview.readiness")} · ${r.title}`} />
                        </TableCell>
                        <TableCell className={cn("tabular text-right", r.missing > 0 ? "font-semibold" : "text-muted-foreground")}>{r.missing}</TableCell>
                        <TableCell className={cn("tabular text-right", r.awaiting > 0 ? "font-semibold text-warning" : "text-muted-foreground")}>{r.awaiting}</TableCell>
                        <TableCell className={cn("tabular text-right", r.rejected > 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{r.rejected}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.lastUpload ? <time dateTime={r.lastUpload.toISOString()} title={fmtDate(r.lastUpload, locale)}>{fmtRelative(r.lastUpload, locale)}</time> : "—"}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Link
                            href={`/projects/${r.id}/documents`}
                            aria-label={t("overview.openChecklist", { project: r.title })}
                            className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <ArrowRight className="size-4" aria-hidden />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* mobile cards */}
              <ul className="divide-y md:hidden">
                {pageRows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/projects/${r.id}/documents`} className="block p-4 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-2xs font-semibold text-primary">{r.code}</p>
                          <p className="truncate text-sm font-medium">{r.title}</p>
                        </div>
                        {r.packageQcPassed && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs font-semibold text-success">
                            <BadgeCheck className="size-3" aria-hidden />
                            {t("overview.qc")}
                          </span>
                        )}
                      </div>
                      <ProgressBar value={r.readiness} label={`${t("overview.readiness")} · ${r.title}`} className="mt-2" />
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div><dt className="text-muted-foreground">{t("overview.missing")}</dt><dd className="tabular font-semibold">{r.missing}</dd></div>
                        <div><dt className="text-muted-foreground">{t("overview.awaitingCol")}</dt><dd className={cn("tabular font-semibold", r.awaiting > 0 && "text-warning")}>{r.awaiting}</dd></div>
                        <div><dt className="text-muted-foreground">{t("overview.rejectedCol")}</dt><dd className={cn("tabular font-semibold", r.rejected > 0 && "text-danger")}>{r.rejected}</dd></div>
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination basePath="/documents" params={params} page={page} pageSize={PAGE_SIZE} total={filtered.length} className="border-t px-4 py-3" />
            </>
          )}
        </section>

        {/* review queue */}
        <section className="self-start rounded-xl border bg-card shadow-card" aria-labelledby="queue-title">
          <div className="border-b p-4">
            <h2 id="queue-title" className="flex items-center gap-2 text-sm font-semibold">
              <FileStack className="size-4 text-warning" aria-hidden />
              {t("overview.queueTitle")}
              <span className="tabular ml-auto rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">{sortedQueue.length}</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("overview.queueSubtitle")}</p>
          </div>
          {sortedQueue.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("overview.queueNone")}</p>
          ) : (
            <ul className="divide-y">
              {sortedQueue.slice(0, 8).map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/projects/${i.projectId}/documents#item-${i.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{itemLabel(i)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono font-semibold text-primary">{i.project.code}</span> · {i.project.title}
                      </p>
                      {i.uploadedAt && (
                        <p className="mt-0.5 text-2xs text-muted-foreground">
                          {t("overview.uploadedWhen", { when: fmtRelative(i.uploadedAt, locale) })}
                          {i.documents[0]?.uploadedBy ? ` · ${i.documents[0].uploadedBy.name}` : ""}
                        </p>
                      )}
                    </div>
                    <EnumBadge enumName="ChecklistStatus" value={i.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {sortedQueue.length > 8 && (
            <p className="border-t px-4 py-3 text-xs">
              <Link href="/documents?status=review&sort=readiness_asc" className="font-medium text-primary hover:underline">
                {t("overview.queueMore", { count: sortedQueue.length - 8 })}
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
