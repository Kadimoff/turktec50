import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, ScrollText, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar, FilterField } from "@/components/admin/filter-bar";
import { Pagination, buildHref, parsePage } from "@/components/admin/pagination";
import { AUDIT_GROUPS, auditWhere, filtersToParams, parseAuditFilters } from "@/components/audit/query";
import { ActionIcon, actionLabel, entityLabel } from "@/components/audit/labels";

const PAGE_SIZE = 50;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("audit") };
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const [t, tc, te, locale] = await Promise.all([getTranslations("audit"), getTranslations("common"), getTranslations("enums"), getLocale()]);

  const filters = parseAuditFilters(sp);
  const page = parsePage(sp.page);
  const params = filtersToParams(filters);
  const where = auditWhere(filters);

  const [total, rows, projects] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, action: true, entity: true, entityId: true, summary: true, createdAt: true,
        actor: { select: { name: true, role: true } },
        project: { select: { id: true, code: true, title: true } },
      },
    }),
    prisma.project.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);
  const filtered = Object.values(params).some(Boolean);
  const exportHref = buildHref("/admin/audit/export", params, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="outline" size="lg" className="h-10" nativeButton={false} render={<a href={exportHref} download />}>
            <Download className="size-4" aria-hidden />
            {tc("actions.exportCsv")}
          </Button>
        }
      />

      <FilterBar action="/admin/audit" clearHref="/admin/audit" active={filtered}>
        <FilterField label={t("filters.group")} htmlFor="a-group">
          <NativeSelect id="a-group" name="group" defaultValue={filters.group ?? ""}>
            <option value="">{tc("actions.all")}</option>
            {AUDIT_GROUPS.map((g) => <option key={g} value={g}>{t(`groups.${g}`)}</option>)}
          </NativeSelect>
        </FilterField>
        <FilterField label={t("filters.actor")} htmlFor="a-actor" className="lg:min-w-52 lg:flex-1">
          <Input id="a-actor" name="actor" type="search" defaultValue={filters.actor} placeholder={t("filters.actorPlaceholder")} className="h-9" />
        </FilterField>
        <FilterField label={t("filters.project")} htmlFor="a-project" className="lg:max-w-56">
          <NativeSelect id="a-project" name="project" defaultValue={filters.project ?? ""}>
            <option value="">{tc("actions.all")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
          </NativeSelect>
        </FilterField>
        <FilterField label={t("filters.from")} htmlFor="a-from" className="lg:min-w-36">
          <Input id="a-from" name="from" type="date" defaultValue={filters.from} className="h-9" />
        </FilterField>
        <FilterField label={t("filters.to")} htmlFor="a-to" className="lg:min-w-36">
          <Input id="a-to" name="to" type="date" defaultValue={filters.to} className="h-9" />
        </FilterField>
      </FilterBar>

      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="audit-list">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="audit-list" className="text-sm font-semibold">{t("listTitle")}</h2>
          <p className="tabular text-xs text-muted-foreground">{t("found", { count: total })}</p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4"><EmptyState icon={ScrollText} title={tc("states.noResults")} description={t("noResultsHint")} /></div>
        ) : (
          <>
            <ul className="divide-y lg:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex gap-3 px-4 py-3">
                  <ActionIcon action={r.action} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{actionLabel(t, r.action)}</p>
                    {r.summary && <p className="truncate text-sm text-muted-foreground">{r.summary}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.actor?.name ?? t("system")}
                      {" · "}
                      <time dateTime={r.createdAt.toISOString()} title={fmtDateTime(r.createdAt, locale)}>{fmtRelative(r.createdAt, locale)}</time>
                    </p>
                    {r.project && (
                      <Link href={`/projects/${r.project.id}/activity`} className="mt-1 inline-block font-mono text-xs font-semibold text-primary hover:underline">
                        {r.project.code}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">{t("cols.time")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("cols.actor")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("cols.action")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("cols.entity")}</TableHead>
                    <TableHead className="pr-5 text-xs font-semibold text-muted-foreground">{t("cols.project")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="h-12">
                      <TableCell className="pl-5">
                        <time dateTime={r.createdAt.toISOString()} className="block text-sm tabular">{fmtDateTime(r.createdAt, locale)}</time>
                        <span className="text-xs text-muted-foreground">{fmtRelative(r.createdAt, locale)}</span>
                      </TableCell>
                      <TableCell>
                        {r.actor ? (
                          <div className="flex items-center gap-2.5">
                            <UserAvatar name={r.actor.name} size="sm" />
                            <div className="min-w-0">
                              <p className="max-w-48 truncate text-sm font-medium">{r.actor.name}</p>
                              <p className="text-xs text-muted-foreground">{te(`Role.${r.actor.role}`)}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("system")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ActionIcon action={r.action} />
                          <span className="text-sm font-medium">{actionLabel(t, r.action)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal">
                        <p className="text-xs text-muted-foreground">{entityLabel(t, r.entity)}</p>
                        {r.summary && <p className="line-clamp-2 text-sm">{r.summary}</p>}
                      </TableCell>
                      <TableCell className="pr-5">
                        {r.project ? (
                          <Link href={`/projects/${r.project.id}/activity`} className="group inline-flex flex-col">
                            <span className="font-mono text-xs font-semibold text-primary">{r.project.code}</span>
                            <span className="max-w-40 truncate text-sm group-hover:underline">{r.project.title}</span>
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <div className="border-t px-4 py-3 sm:px-5">
          <Pagination basePath="/admin/audit" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-dashed bg-card px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden />
        <span>{t("retentionNote")}</span>
      </p>
    </div>
  );
}
