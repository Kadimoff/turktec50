import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarClock, Eye, FolderSearch, ListChecks, ShieldAlert, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import { bakuDayDiff, bakuYmd } from "@/lib/dates";
import { matchesQuery } from "@/lib/search";
import { buildHref, parsePage, pick, str, type SearchParams } from "@/lib/search-params";
import { riskLevelTone, riskStatusTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RISK_LEVELS, riskLevel, riskScore } from "./level";
import { RiskFormDialog } from "./risk-form-dialog";
import { RiskRowActions } from "./risk-row-actions";
import type { RiskFormValue, ScopeOption } from "./types";

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["active", "OPEN", "MITIGATING", "CLOSED", "all"] as const;

/**
 * Risk register (stats, 3×3 heat matrix, filters, list) — used by /risks (all risks in scope) and /projects/[id]/risks.
 * Visibility: ADMIN all; MENTOR assigned projects + program-level (read-only); TEAM own project(s). JURY never reaches this.
 */
export async function RiskRegister({ user, projectId, basePath, searchParams }: { user: CurrentUser; projectId?: string; basePath: string; searchParams: SearchParams }) {
  const [t, te, locale] = await Promise.all([getTranslations("risks"), getTranslations("enums"), getLocale()]);

  const where: Prisma.RiskWhereInput = projectId
    ? { projectId, project: projectScope(user) }
    : user.role === "ADMIN"
      ? {}
      : user.role === "MENTOR"
        ? { OR: [{ projectId: null }, { project: projectScope(user) }] }
        : { project: projectScope(user) };

  const [risks, scopeProjects] = await Promise.all([
    prisma.risk.findMany({
      where,
      select: {
        id: true, title: true, description: true, probability: true, impact: true, mitigation: true, status: true, reviewDate: true, projectId: true,
        owner: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, title: true } },
      },
    }),
    projectId
      ? prisma.project.findMany({ where: { id: projectId }, select: { id: true, code: true, title: true } })
      : prisma.project.findMany({ where: projectScope(user), select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }),
  ]);

  const canEdit = (r: { projectId: string | null }) => user.role === "ADMIN" || (r.projectId !== null && (user.role === "TEAM" || user.role === "MENTOR"));
  const canCreate = user.role === "ADMIN" || ((user.role === "TEAM" || user.role === "MENTOR") && scopeProjects.length > 0);

  // ---- filters
  const sp = searchParams;
  const q = str(sp.q, 80);
  const status = pick(sp.status, STATUS_FILTERS, "active");
  const level = pick(sp.level, RISK_LEVELS);
  const scopeFilter = projectId ? undefined : str(sp.scope);
  const pf = pick(sp.p, RISK_LEVELS);
  const iff = pick(sp.i, RISK_LEVELS);
  const cell = pf && iff ? { p: pf, i: iff } : undefined;
  const pageReq = parsePage(sp.page);

  // review dates are Baku calendar days
  const now = new Date();
  const rows = risks.map((r) => ({
    ...r,
    level: riskLevel(r.probability, r.impact),
    score: riskScore(r.probability, r.impact),
    review: bakuYmd(r.reviewDate),
    days: r.reviewDate ? bakuDayDiff(now, r.reviewDate) : null,
  }));
  const active = rows.filter((r) => r.status !== "CLOSED");

  const base = rows.filter(
    (r) =>
      (!q || matchesQuery(q, r.title, r.mitigation)) &&
      (!level || r.level === level) &&
      (!scopeFilter || (scopeFilter === "program" ? r.projectId === null : scopeFilter === "projects" ? r.projectId !== null : r.projectId === scopeFilter)),
  );
  const matrixSet = base.filter((r) => r.status !== "CLOSED");
  const listed = base
    .filter((r) => (status === "all" ? true : status === "active" ? r.status !== "CLOSED" : r.status === status))
    .filter((r) => !cell || (r.probability === cell.p && r.impact === cell.i))
    .sort((a, b) => b.score - a.score || (a.review || "9999").localeCompare(b.review || "9999") || a.title.localeCompare(b.title));
  const pages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const page = Math.min(pageReq, pages);
  const pageRows = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ---- stats (whole visible register, independent of filters)
  const openN = active.filter((r) => r.status === "OPEN").length;
  const mitigatingN = active.length - openN;
  const highN = active.filter((r) => r.level === "HIGH").length;
  const withPlan = active.filter((r) => (r.mitigation ?? "").trim().length > 0).length;
  const planPct = active.length ? Math.round((withPlan / active.length) * 100) : 0;
  const dueWeek = active.filter((r) => r.days !== null && r.days >= 0 && r.days <= 7).length;
  const overdue = active.filter((r) => r.days !== null && r.days < 0).length;

  const params = {
    q,
    status: status === "active" ? undefined : status,
    level,
    scope: scopeFilter,
    p: cell?.p,
    i: cell?.i,
  };
  const hrefFor = (over: Record<string, string | undefined>) => buildHref(basePath, params, over);

  // create-dialog scope options
  const scopes: ScopeOption[] = [
    ...(user.role === "ADMIN" && !projectId ? [{ value: "program", label: t("form.programLevel") }] : []),
    ...scopeProjects.map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` })),
  ];
  const projectsWithRisks = [...new Map(rows.filter((r) => r.project).map((r) => [r.project!.id, r.project!])).values()].sort((a, b) => a.code.localeCompare(b.code));

  const showScopeFilter = !projectId && (projectsWithRisks.length > 1 || rows.some((r) => r.projectId === null));

  const toForm = (r: (typeof rows)[number]): RiskFormValue => ({
    id: r.id,
    title: r.title,
    description: r.description,
    probability: r.probability,
    impact: r.impact,
    mitigation: r.mitigation,
    ownerId: r.owner?.id ?? null,
    ownerName: r.owner?.name ?? null,
    reviewDate: r.review,
    status: r.status,
    scope: r.projectId ?? "program",
  });

  const reviewLabel = (r: (typeof rows)[number]) => {
    if (!r.reviewDate || r.days === null) return <span className="text-muted-foreground">{t("table.noReview")}</span>;
    const overdueRow = r.days < 0 && r.status !== "CLOSED";
    return (
      <span className={cn("block whitespace-nowrap", overdueRow && "font-semibold text-danger")}>
        <time dateTime={r.review}>{fmtDate(r.reviewDate, locale)}</time>
        {r.status !== "CLOSED" && (
          <span className={cn("block text-2xs font-normal", overdueRow ? "text-danger" : "text-muted-foreground")}>
            {overdueRow && <AlertTriangle className="mr-0.5 inline size-3 align-[-2px]" aria-hidden />}
            {r.days < 0 ? t("table.overdueBy", { count: -r.days }) : r.days === 0 ? t("table.dueToday") : t("table.dueIn", { count: r.days })}
          </span>
        )}
      </span>
    );
  };
  const projectCell = (r: (typeof rows)[number]) =>
    r.project ? (
      <Link href={`/projects/${r.project.id}/risks`} className="group block min-w-0 hover:text-primary">
        <span className="font-mono text-2xs font-semibold text-primary">{r.project.code}</span>
        <span className="block truncate text-xs group-hover:underline">{r.project.title}</span>
      </Link>
    ) : (
      <ToneBadge tone="brand" dot={false}>{t("program")}</ToneBadge>
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <StatCard label={t("stats.active")} value={active.length} icon={ShieldAlert} tone="danger" hint={t("stats.activeHint", { open: openN, mitigating: mitigatingN })} />
        <StatCard label={t("stats.high")} value={highN} icon={AlertTriangle} tone="warning" hint={t("stats.highHint")} />
        <StatCard
          label={t("stats.mitigation")}
          value={`${withPlan}/${active.length}`}
          icon={ListChecks}
          tone="success"
          target={Math.max(1, active.length)}
          current={withPlan}
          hint={t("stats.mitigationHint", { pct: `${planPct}%` })}
        />
        <StatCard label={t("stats.review")} value={dueWeek} icon={CalendarClock} tone={overdue > 0 ? "danger" : "info"} hint={t("stats.reviewHint", { count: overdue })} />
      </div>

        {/* 3×3 heat matrix */}
        <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="risk-matrix-title">
          <h2 id="risk-matrix-title" className="text-sm font-semibold">{t("matrix.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("matrix.subtitle")}</p>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <div className="flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground [writing-mode:vertical-rl] rotate-180">{t("matrix.impact")} →</span>
            </div>
            <div>
              <div role="list" aria-label={t("matrix.title")} className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5">
                {(["HIGH", "MEDIUM", "LOW"] as const).map((imp) => (
                  <div key={imp} className="contents" role="presentation">
                    <span className="flex items-center justify-end pr-1 text-2xs font-medium text-muted-foreground" aria-hidden>{te(`RiskLevel.${imp}`)}</span>
                    {(["LOW", "MEDIUM", "HIGH"] as const).map((prob) => {
                      const lvl = riskLevel(prob, imp);
                      const count = matrixSet.filter((r) => r.probability === prob && r.impact === imp).length;
                      const selected = cell?.p === prob && cell?.i === imp;
                      const tone = riskLevelTone[lvl];
                      return (
                        <Link
                          key={prob}
                          role="listitem"
                          href={selected ? hrefFor({ p: undefined, i: undefined, page: undefined }) : hrefFor({ p: prob, i: imp, page: undefined })}
                          scroll={false}
                          aria-current={selected ? "true" : undefined}
                          aria-label={t("matrix.cell", { p: te(`RiskLevel.${prob}`), i: te(`RiskLevel.${imp}`), level: te(`RiskLevel.${lvl}`), count })}
                          className={cn(
                            "flex aspect-[4/3] min-h-14 flex-col items-center justify-center rounded-lg border border-transparent text-center transition-[box-shadow,opacity] focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                            tone === "danger" && "bg-danger-soft text-danger",
                            tone === "warning" && "bg-warning-soft text-warning",
                            tone === "success" && "bg-success-soft text-success",
                            count === 0 && "opacity-60",
                            selected && "border-current ring-2 ring-current",
                            "hover:ring-2 hover:ring-current/40",
                          )}
                        >
                          <span className="tabular text-xl leading-none font-bold">{count}</span>
                          <span className="mt-1 text-2xs leading-none font-semibold">{te(`RiskLevel.${lvl}`)}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
                <span aria-hidden />
                {(["LOW", "MEDIUM", "HIGH"] as const).map((prob) => (
                  <span key={prob} className="text-center text-2xs font-medium text-muted-foreground" aria-hidden>{te(`RiskLevel.${prob}`)}</span>
                ))}
              </div>
              <p className="mt-1.5 text-center text-xs font-semibold text-muted-foreground" aria-hidden>{t("matrix.probability")} →</p>
            </div>
          </div>
          {cell && (
            <Link href={hrefFor({ p: undefined, i: undefined, page: undefined })} scroll={false} className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-muted">
              <X className="size-3.5" aria-hidden />
              {t("matrix.clear")}
            </Link>
          )}
        </section>
      </div>

        {/* list */}
        <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="risk-list-title">
          <div className="space-y-1 px-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h2 id="risk-list-title" className="text-sm font-semibold">{t("table.title")}</h2>
                <span className="tabular text-xs text-muted-foreground">{t("table.results", { count: listed.length })}</span>
              </div>
              {canCreate && <RiskFormDialog mode="create" scopes={scopes} defaultScope={projectId} />}
            </div>
            {cell && (
              <p className="text-xs font-medium text-muted-foreground" role="status">
                {t("filters.matrixActive", { p: te(`RiskLevel.${cell.p}`), i: te(`RiskLevel.${cell.i}`) })}
              </p>
            )}
          </div>
          <FilterBar
            action={basePath}
            variant="inline"
            keep={{ p: cell?.p, i: cell?.i }}
            search={{ label: t("filters.q"), placeholder: t("filters.qPlaceholder"), value: q }}
            selects={[
              {
                name: "status",
                label: t("filters.status"),
                allLabel: t("filters.active"),
                value: status === "active" ? "" : status,
                options: [
                  ...(["OPEN", "MITIGATING", "CLOSED"] as const).map((s) => ({ value: s, label: te(`RiskStatus.${s}`) })),
                  { value: "all", label: t("filters.all") },
                ],
              },
              { name: "level", label: t("filters.level"), allLabel: t("filters.anyLevel"), value: level, options: RISK_LEVELS.map((l) => ({ value: l, label: te(`RiskLevel.${l}`) })) },
              ...(showScopeFilter
                ? [{
                    name: "scope",
                    label: t("filters.scope"),
                    allLabel: t("filters.anyScope"),
                    value: scopeFilter,
                    wide: true,
                    options: [
                      ...(rows.some((r) => r.projectId === null) ? [{ value: "program", label: t("filters.programOnly") }] : []),
                      { value: "projects", label: t("filters.projectsOnly") },
                      ...projectsWithRisks.map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` })),
                    ],
                  }]
                : []),
            ]}
          />

          {pageRows.length === 0 ? (
            <EmptyState icon={FolderSearch} title={t("table.empty")} description={t("table.emptyHint")} className="m-4" />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[940px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">{t("table.risk")}</TableHead>
                      {!projectId && <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.project")}</TableHead>}
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.level")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.owner")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.mitigation")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.status")}</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">{t("table.review")}</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r.id} className={cn("align-top hover:bg-muted/50", r.status === "CLOSED" && "text-muted-foreground")}>
                        <TableCell className="w-[22%] min-w-56 pl-4 whitespace-normal">
                          <p className="font-medium text-pretty">{r.title}</p>
                          {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                        </TableCell>
                        {!projectId && <TableCell className="max-w-40">{projectCell(r)}</TableCell>}
                        <TableCell>
                          <ToneBadge tone={riskLevelTone[r.level]}>{te(`RiskLevel.${r.level}`)}</ToneBadge>
                          <p className="mt-1 text-2xs whitespace-nowrap text-muted-foreground">
                            {t("table.pxi", { p: te(`RiskLevel.${r.probability}`), i: te(`RiskLevel.${r.impact}`) })}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-40">
                          {r.owner ? (
                            <span className="flex items-center gap-2">
                              <UserAvatar name={r.owner.name} size="sm" />
                              <span className="truncate text-xs">{r.owner.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("table.noOwner")}</span>
                          )}
                        </TableCell>
                        <TableCell className="w-[24%] min-w-56 whitespace-normal">
                          {r.mitigation ? <p className="line-clamp-3 text-xs">{r.mitigation}</p> : <span className="text-xs font-medium text-warning">{t("table.noMitigation")}</span>}
                        </TableCell>
                        <TableCell><ToneBadge tone={riskStatusTone[r.status]}>{te(`RiskStatus.${r.status}`)}</ToneBadge></TableCell>
                        <TableCell className="text-xs">{reviewLabel(r)}</TableCell>
                        <TableCell className="pr-4 text-right">
                          {canEdit(r) ? (
                            <RiskRowActions risk={toForm(r)} compact />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground"><Eye className="size-3.5" aria-hidden />{t("table.readOnly")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* stacked cards below lg */}
              <ul className="divide-y lg:hidden">
                {pageRows.map((r) => (
                  <li key={r.id} className={cn("space-y-2.5 p-4", r.status === "CLOSED" && "text-muted-foreground")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-pretty">{r.title}</p>
                        {!projectId && <div className="mt-1">{projectCell(r)}</div>}
                      </div>
                      <ToneBadge tone={riskStatusTone[r.status]} className="shrink-0">{te(`RiskStatus.${r.status}`)}</ToneBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge tone={riskLevelTone[r.level]}>{te(`RiskLevel.${r.level}`)}</ToneBadge>
                      <span className="text-xs text-muted-foreground">{t("table.pxi", { p: te(`RiskLevel.${r.probability}`), i: te(`RiskLevel.${r.impact}`) })}</span>
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-muted-foreground">{t("table.mitigation")}</p>
                      {r.mitigation ? <p className="mt-0.5 text-pretty">{r.mitigation}</p> : <p className="mt-0.5 font-medium text-warning">{t("table.noMitigation")}</p>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <dt className="font-semibold text-muted-foreground">{t("table.owner")}</dt>
                        <dd className="mt-0.5 truncate">{r.owner?.name ?? t("table.noOwner")}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-muted-foreground">{t("table.review")}</dt>
                        <dd className="mt-0.5">{reviewLabel(r)}</dd>
                      </div>
                    </dl>
                    {canEdit(r) ? (
                      <div className="-mr-2 flex justify-end"><RiskRowActions risk={toForm(r)} /></div>
                    ) : (
                      <p className="inline-flex items-center gap-1 text-2xs text-muted-foreground"><Eye className="size-3.5" aria-hidden />{t("table.readOnly")}</p>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination basePath={basePath} params={params} page={page} pageSize={PAGE_SIZE} total={listed.length} className="border-t p-4" />
            </>
          )}
        </section>
    </div>
  );
}
