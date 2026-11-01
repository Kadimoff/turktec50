import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarClock, Eye, FolderSearch, ListChecks, Search, ShieldAlert, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import { riskLevelTone, riskStatusTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitForm } from "@/components/documents/auto-submit-form";
import { Pagination } from "@/components/documents/pagination";
import { RISK_LEVELS, riskLevel, riskScore, toDateInput, type RiskLevelValue } from "./level";
import { RiskFormDialog } from "./risk-form-dialog";
import { RiskRowActions } from "./risk-row-actions";
import type { RiskFormValue, ScopeOption } from "./types";

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["active", "OPEN", "MITIGATING", "CLOSED", "all"] as const;
type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isLevel = (v: string | undefined): v is RiskLevelValue => !!v && (RISK_LEVELS as readonly string[]).includes(v);

/** whole days between two yyyy-mm-dd (Asia/Baku) dates */
function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Risk register (stats, 3×3 heat matrix, filters, list) — used by /risks (all risks in scope) and /projects/[id]/risks.
 * Visibility: ADMIN all; MENTOR assigned projects + program-level (read-only); TEAM own project(s). JURY never reaches this.
 */
export async function RiskRegister({ user, projectId, basePath, searchParams }: { user: CurrentUser; projectId?: string; basePath: string; searchParams: Search }) {
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
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const status = STATUS_FILTERS.find((s) => s === one(sp.status)) ?? "active";
  const level = isLevel(one(sp.level)) ? (one(sp.level) as RiskLevelValue) : undefined;
  const scopeFilter = projectId ? undefined : one(sp.scope) || undefined;
  const pf = isLevel(one(sp.p)) ? (one(sp.p) as RiskLevelValue) : undefined;
  const iff = isLevel(one(sp.i)) ? (one(sp.i) as RiskLevelValue) : undefined;
  const cell = pf && iff ? { p: pf, i: iff } : undefined;
  const pageReq = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const today = toDateInput(new Date());
  const rows = risks.map((r) => {
    const review = r.reviewDate ? toDateInput(r.reviewDate) : "";
    return { ...r, level: riskLevel(r.probability, r.impact), score: riskScore(r.probability, r.impact), review, days: review ? dayDiff(today, review) : null };
  });
  const active = rows.filter((r) => r.status !== "CLOSED");

  const needle = q.toLocaleLowerCase(locale);
  const base = rows.filter(
    (r) =>
      (!needle || r.title.toLocaleLowerCase(locale).includes(needle) || (r.mitigation ?? "").toLocaleLowerCase(locale).includes(needle)) &&
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
    q: q || undefined,
    status: status === "active" ? undefined : status,
    level,
    scope: scopeFilter,
    p: cell?.p,
    i: cell?.i,
  };
  const hrefWith = (over: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) if (v) s.set(k, v);
    const qs = s.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

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
          <span className={cn("block text-[11px] font-normal", overdueRow ? "text-danger" : "text-muted-foreground")}>
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
        <span className="font-mono text-[11px] font-semibold text-primary">{r.project.code}</span>
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
                    <span className="flex items-center justify-end pr-1 text-[11px] font-medium text-muted-foreground" aria-hidden>{te(`RiskLevel.${imp}`)}</span>
                    {(["LOW", "MEDIUM", "HIGH"] as const).map((prob) => {
                      const lvl = riskLevel(prob, imp);
                      const count = matrixSet.filter((r) => r.probability === prob && r.impact === imp).length;
                      const selected = cell?.p === prob && cell?.i === imp;
                      const tone = riskLevelTone[lvl];
                      return (
                        <Link
                          key={prob}
                          role="listitem"
                          href={selected ? hrefWith({ p: undefined, i: undefined, page: undefined }) : hrefWith({ p: prob, i: imp, page: undefined })}
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
                          <span className="mt-1 text-[10px] leading-none font-semibold">{te(`RiskLevel.${lvl}`)}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
                <span aria-hidden />
                {(["LOW", "MEDIUM", "HIGH"] as const).map((prob) => (
                  <span key={prob} className="text-center text-[11px] font-medium text-muted-foreground" aria-hidden>{te(`RiskLevel.${prob}`)}</span>
                ))}
              </div>
              <p className="mt-1.5 text-center text-xs font-semibold text-muted-foreground" aria-hidden>{t("matrix.probability")} →</p>
            </div>
          </div>
          {cell && (
            <Link href={hrefWith({ p: undefined, i: undefined, page: undefined })} scroll={false} className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-muted">
              <X className="size-3.5" aria-hidden />
              {t("matrix.clear")}
            </Link>
          )}
        </section>
      </div>

        {/* list */}
        <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="risk-list-title">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h2 id="risk-list-title" className="text-sm font-semibold">{t("table.title")}</h2>
                <span className="tabular text-xs text-muted-foreground">{t("table.results", { count: listed.length })}</span>
              </div>
              {canCreate && <RiskFormDialog mode="create" scopes={scopes} defaultScope={projectId} />}
            </div>
            <AutoSubmitForm action={basePath} className={cn("grid gap-2 sm:grid-cols-2 sm:items-end", !showScopeFilter ? "lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]" : "lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]")}>
              <div className="grid gap-1 sm:col-span-2 lg:col-span-1">
                <label htmlFor="risk-q" className="text-xs font-medium text-muted-foreground">{t("filters.q")}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="risk-q" name="q" type="search" defaultValue={q} placeholder={t("filters.qPlaceholder")} className="h-9 pl-8" />
                </div>
              </div>
              <div className="grid gap-1">
                <label htmlFor="risk-status" className="text-xs font-medium text-muted-foreground">{t("filters.status")}</label>
                <NativeSelect id="risk-status" name="status" defaultValue={status === "active" ? "" : status} className="lg:w-40">
                  <option value="">{t("filters.active")}</option>
                  {(["OPEN", "MITIGATING", "CLOSED"] as const).map((s) => <option key={s} value={s}>{te(`RiskStatus.${s}`)}</option>)}
                  <option value="all">{t("filters.all")}</option>
                </NativeSelect>
              </div>
              <div className="grid gap-1">
                <label htmlFor="risk-level" className="text-xs font-medium text-muted-foreground">{t("filters.level")}</label>
                <NativeSelect id="risk-level" name="level" defaultValue={level ?? ""} className="lg:w-40">
                  <option value="">{t("filters.anyLevel")}</option>
                  {RISK_LEVELS.map((l) => <option key={l} value={l}>{te(`RiskLevel.${l}`)}</option>)}
                </NativeSelect>
              </div>
              {showScopeFilter && (
                <div className="grid gap-1">
                  <label htmlFor="risk-scope" className="text-xs font-medium text-muted-foreground">{t("filters.scope")}</label>
                  <NativeSelect id="risk-scope" name="scope" defaultValue={scopeFilter ?? ""} className="lg:w-48">
                    <option value="">{t("filters.anyScope")}</option>
                    {rows.some((r) => r.projectId === null) && <option value="program">{t("filters.programOnly")}</option>}
                    <option value="projects">{t("filters.projectsOnly")}</option>
                    {projectsWithRisks.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
                  </NativeSelect>
                </div>
              )}
              {cell && <input type="hidden" name="p" value={cell.p} />}
              {cell && <input type="hidden" name="i" value={cell.i} />}
              <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="h-9 flex-1 lg:flex-none">{t("filters.apply")}</Button>
                {(q || status !== "active" || level || scopeFilter || cell) && (
                  <Button variant="ghost" className="h-9" nativeButton={false} render={<Link href={basePath} scroll={false} />}>
                    {t("filters.reset")}
                  </Button>
                )}
              </div>
            </AutoSubmitForm>
            {cell && (
              <p className="text-xs font-medium text-muted-foreground" role="status">
                {t("filters.matrixActive", { p: te(`RiskLevel.${cell.p}`), i: te(`RiskLevel.${cell.i}`) })}
              </p>
            )}
          </div>

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
                          <p className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
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
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="size-3.5" aria-hidden />{t("table.readOnly")}</span>
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
                      <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="size-3.5" aria-hidden />{t("table.readOnly")}</p>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination basePath={basePath} params={params} page={page} pageSize={PAGE_SIZE} total={listed.length} />
            </>
          )}
        </section>
    </div>
  );
}
