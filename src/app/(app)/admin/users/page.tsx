import { getLocale, getTranslations } from "next-intl/server";
import { Crown, Gavel, GraduationCap, KeyRound, ShieldCheck, ShieldUser, UserRoundSearch, UsersRound } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import type { Tone } from "@/lib/tones";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar, FilterField } from "@/components/admin/filter-bar";
import { Pagination, parsePage, str } from "@/components/admin/pagination";
import { CreateUserDialog, LockedRow, UserRowActions } from "@/components/admin/user-dialogs";

const PAGE_SIZE = 25;
const ROLES: Role[] = ["ADMIN", "TEAM", "MENTOR", "JURY"];
const roleTone: Record<Role, Tone> = { ADMIN: "brand", TEAM: "info", MENTOR: "success", JURY: "warning" };
const roleIcon = { ADMIN: ShieldUser, TEAM: GraduationCap, MENTOR: UsersRound, JURY: Gavel } as const;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

export default async function UsersPage(props: PageProps<"/admin/users">) {
  const me = await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const [t, tc, te, tr, locale] = await Promise.all([getTranslations("admin.users"), getTranslations("common"), getTranslations("enums"), getTranslations("admin.users.root"), getLocale()]);

  const q = str(sp.q);
  const role = ROLES.find((r) => r === str(sp.role));
  const uni = str(sp.uni);
  const status = (["active", "inactive"] as const).find((s) => s === str(sp.status));
  const page = parsePage(sp.page);
  const params = { q, role, uni, status };

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(uni && { universityId: uni === "none" ? null : uni }),
    ...(status && { active: status === "active" }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] }),
  };

  const [rootUser, byRole, total, users, universities] = await Promise.all([
    prisma.user.findFirst({ where: { isRoot: true }, select: { id: true, name: true, email: true, title: true, lastLoginAt: true } }),
    prisma.user.groupBy({ by: ["role", "active"], _count: { _all: true } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ isRoot: "desc" }, { name: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, role: true, isRoot: true, title: true, active: true, lastLoginAt: true, universityId: true,
        university: { select: { shortName: true } },
        _count: { select: { memberships: true, mentorAssignments: true, juryAssignments: true } },
      },
    }),
    prisma.university.findMany({ orderBy: { shortName: "asc" }, select: { id: true, shortName: true, name: true } }),
  ]);

  const count = (r: Role, active?: boolean) =>
    byRole.filter((g) => g.role === r && (active === undefined || g.active === active)).reduce((a, g) => a + g._count._all, 0);
  const linked = (u: (typeof users)[number]) => u._count.memberships + u._count.mentorAssignments + u._count.juryAssignments;
  const filtered = !!(q || role || uni || status);
  // root is untouchable for everyone else; coordinators (ADMIN) are managed by root only
  const lockFor = (u: (typeof users)[number]): "root" | "admin" | null =>
    u.isRoot && !me.isRoot ? "root" : !u.isRoot && u.role === "ADMIN" && !me.isRoot ? "admin" : null;
  const actionsFor = (u: (typeof users)[number]) => {
    const lock = lockFor(u);
    return lock ? <LockedRow reason={lock} /> : <UserRowActions user={u} universities={universities} isSelf={u.id === me.id} canGrantAdmin={me.isRoot} canDelete={me.isRoot} />;
  };
  const RootBadge = () => (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-bold text-background">
      <Crown className="size-3" aria-hidden />
      {tr("badge")}
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<CreateUserDialog universities={universities} canCreateAdmin={me.isRoot} />}
      />

      {rootUser && (
        <section aria-labelledby="root-title" className="relative overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-card">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-sidebar-primary/15 blur-2xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground" aria-hidden>
                <Crown className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-sidebar-primary">{tr("cardEyebrow")}</p>
                <h2 id="root-title" className="text-lg font-bold text-white">
                  {rootUser.name}
                  {rootUser.id === me.id && <span className="ml-2 text-xs font-normal text-sidebar-foreground/80">({t("you")})</span>}
                </h2>
                <p className="truncate text-sm text-sidebar-foreground/85">{rootUser.email}</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/75">
                  {t("cols.lastLogin")}: {rootUser.lastLoginAt ? fmtRelative(rootUser.lastLoginAt, locale) : t("never")}
                </p>
              </div>
            </div>
            <ul className="grid gap-1.5 text-[13px] md:max-w-md">
              {(["c1", "c2", "c3"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" aria-hidden />
                  <span>{tr(`capabilities.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {ROLES.map((r) => (
          <StatCard
            key={r}
            label={te(`Role.${r}`)}
            value={count(r)}
            icon={roleIcon[r]}
            tone={roleTone[r]}
            hint={t("statHint", { active: count(r, true), inactive: count(r, false) })}
          />
        ))}
      </div>

      <FilterBar action="/admin/users" clearHref="/admin/users" active={filtered}>
        <FilterField label={tc("actions.search")} htmlFor="f-q" className="lg:min-w-64 lg:flex-1">
          <Input id="f-q" name="q" type="search" defaultValue={q} placeholder={t("searchPlaceholder")} className="h-9" />
        </FilterField>
        <FilterField label={t("fields.role")} htmlFor="f-role">
          <NativeSelect id="f-role" name="role" defaultValue={role ?? ""}>
            <option value="">{tc("actions.all")}</option>
            {ROLES.map((r) => <option key={r} value={r}>{te(`Role.${r}`)}</option>)}
          </NativeSelect>
        </FilterField>
        <FilterField label={t("fields.university")} htmlFor="f-uni">
          <NativeSelect id="f-uni" name="uni" defaultValue={uni ?? ""}>
            <option value="">{tc("actions.all")}</option>
            <option value="none">{t("noUniversity")}</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName}</option>)}
          </NativeSelect>
        </FilterField>
        <FilterField label={t("fields.status")} htmlFor="f-status">
          <NativeSelect id="f-status" name="status" defaultValue={status ?? ""}>
            <option value="">{tc("actions.all")}</option>
            <option value="active">{t("active")}</option>
            <option value="inactive">{t("inactive")}</option>
          </NativeSelect>
        </FilterField>
      </FilterBar>

      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="users-title">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="users-title" className="text-sm font-semibold">{t("listTitle")}</h2>
          <p className="tabular text-xs text-muted-foreground">{t("found", { count: total })}</p>
        </div>

        {users.length === 0 ? (
          <div className="p-4"><EmptyState icon={UserRoundSearch} title={tc("states.noResults")} description={t("noResultsHint")} /></div>
        ) : (
          <>
            {/* mobile: stacked cards */}
            <ul className="divide-y lg:hidden">
              {users.map((u) => (
                <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                  <UserAvatar name={u.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{u.name}{u.isRoot && <RootBadge />}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    {u.title && <p className="truncate text-xs text-muted-foreground">{u.title}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone={roleTone[u.role]}>{te(`Role.${u.role}`)}</ToneBadge>
                      {!u.active && <ToneBadge tone="neutral">{t("inactive")}</ToneBadge>}
                      {u.university && <span className="text-xs text-muted-foreground">{u.university.shortName}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("linkedShort", { count: linked(u) })} · {u.lastLoginAt ? fmtRelative(u.lastLoginAt, locale) : t("never")}
                    </p>
                  </div>
                  {actionsFor(u)}
                </li>
              ))}
            </ul>

            {/* desktop: table */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">{t("cols.user")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("fields.role")}</TableHead>
                    <TableHead className="hidden text-xs font-semibold text-muted-foreground 2xl:table-cell">{t("fields.title")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("fields.university")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("cols.linked")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("cols.lastLogin")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("fields.status")}</TableHead>
                    <TableHead className="pr-5 text-right text-xs font-semibold text-muted-foreground"><span className="sr-only">{t("cols.actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={u.active ? "h-14" : "h-14 text-muted-foreground"}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <p className="flex max-w-72 items-center gap-1.5 truncate font-medium text-foreground">
                              {u.name}
                              {u.isRoot && <RootBadge />}
                              {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t("you")})</span>}
                            </p>
                            <p className="max-w-60 truncate text-xs text-muted-foreground">{u.email}</p>
                            {u.title && <p className="max-w-60 truncate text-xs text-muted-foreground 2xl:hidden">{u.title}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><ToneBadge tone={roleTone[u.role]}>{te(`Role.${u.role}`)}</ToneBadge></TableCell>
                      <TableCell className="hidden 2xl:table-cell"><span className="block max-w-48 truncate" title={u.title ?? undefined}>{u.title ?? "—"}</span></TableCell>
                      <TableCell>{u.university?.shortName ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className="tabular"
                          title={t("linkedTitle", { members: u._count.memberships, mentor: u._count.mentorAssignments, jury: u._count.juryAssignments })}
                        >
                          {linked(u)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.lastLoginAt ? (
                          <time dateTime={u.lastLoginAt.toISOString()} title={fmtDateTime(u.lastLoginAt, locale)} className="text-sm">
                            {fmtRelative(u.lastLoginAt, locale)}
                          </time>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("never")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.active ? <ToneBadge tone="success">{t("active")}</ToneBadge> : <ToneBadge tone="neutral">{t("inactive")}</ToneBadge>}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {actionsFor(u)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <div className="border-t px-4 py-3 sm:px-5">
          <Pagination basePath="/admin/users" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-dashed bg-card px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden />
        <span>{t("privacyNote")}</span>
      </p>
    </div>
  );
}
