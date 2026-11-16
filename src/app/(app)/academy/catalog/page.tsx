import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Eye, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { COMPETITION_THEMES } from "@/lib/constants";
import { bakuYmd } from "@/lib/dates";
import { folded } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/tone-badge";
import { CatalogSummary } from "@/components/academy/catalog/catalog-summary";
import { CatalogBrowser } from "@/components/academy/catalog/catalog-browser";
import { CompetitionCard, type CatalogCompetition } from "@/components/academy/catalog/competition-card";
import type { CatalogItem } from "@/components/academy/catalog/types";

export default async function CatalogPage() {
  const user = await requireUser(["ADMIN", "TEAM", "MENTOR"]);
  const isAdmin = user.role === "ADMIN";
  const [t, tc, locale] = await Promise.all([getTranslations("catalog"), getTranslations("common"), getLocale()]);

  const [rows, owners] = await Promise.all([
    prisma.competition.findMany({
      where: { catalogId: { not: null } },
      select: {
        id: true, name: true, url: true, theme: true, subcategories: true, applicationDeadline: true, finalDate: true,
        ruleStatus: true, ruleSourceUrl: true, ruleCheckedAt: true, ruleNotes: true,
        ruleOwner: { select: { id: true, name: true, active: true } },
        _count: { select: { projects: true, teams: { where: { status: { not: "ARCHIVED" } } } } },
      },
    }),
    isAdmin ? prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const today = bakuYmd(new Date());
  const competitions: CatalogCompetition[] = rows
    .map(({ _count, ...c }) => ({ ...c, projects: _count.projects, teams: _count.teams }))
    // tracked cards first (nearest deadline first), then the rest of the catalog alphabetically
    .sort(
      (a, b) =>
        Number(b.ruleStatus !== null) - Number(a.ruleStatus !== null) ||
        (a.ruleStatus !== null ? (a.applicationDeadline?.getTime() ?? Infinity) - (b.applicationDeadline?.getTime() ?? Infinity) : 0) ||
        a.name.localeCompare(b.name, "tr"),
    );
  const admin = isAdmin ? { currentUserId: user.id, owners } : null;

  const items: CatalogItem[] = competitions.map((c) => ({
    id: c.id,
    theme: c.theme,
    status: c.ruleStatus,
    haystack: folded([c.name, ...c.subcategories].join(" ")),
    node: <CompetitionCard c={c} locale={locale} today={today} admin={admin} canApply={user.role === "TEAM"} />,
  }));
  const themes = COMPETITION_THEMES.map((value) => ({
    value,
    label: tc(`directions.${value}`),
    count: competitions.filter((c) => c.theme === value).length,
  }))
    .filter((o) => o.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const tracked = competitions.filter((c) => c.ruleStatus !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={isAdmin ? t("description") : `${t("description")} ${t("readOnlyNote")}`}
        actions={!isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {user.role === "TEAM" && (
              <Button size="lg" nativeButton={false} render={<Link href="/apply" />}>
                <Send aria-hidden />
                {t("applyCta")}
              </Button>
            )}
            <ToneBadge tone="neutral" dot={false} className="py-1">
              <Eye className="size-3.5" aria-hidden />
              {t("readOnly")}
            </ToneBadge>
          </div>
        )}
      />
      <CatalogSummary
        cards={competitions.length}
        subcategories={competitions.reduce((n, c) => n + c.subcategories.length, 0)}
        tracked={tracked.length}
        changed={tracked.filter((c) => c.ruleStatus === "CHANGED").length}
        confirmed={tracked.filter((c) => c.ruleStatus === "CONFIRMED").length}
      />
      <CatalogBrowser items={items} themes={themes} />
    </div>
  );
}
