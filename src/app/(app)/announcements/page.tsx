import { getTranslations } from "next-intl/server";
import { FilePenLine, Megaphone } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AnnouncementCard, announcementSelect, type AnnouncementRow } from "@/components/announcements/announcement-card";
import { AnnouncementDialog } from "@/components/announcements/announcement-dialogs";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("announcements") };
}

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const t = await getTranslations("announcements");

  if (user.role !== "ADMIN") {
    // only published announcements addressed to the viewer's role
    const rows = await prisma.announcement.findMany({
      where: { status: "PUBLISHED", audience: { has: user.role } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: announcementSelect,
    });
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <section aria-labelledby="announcements-feed" className="max-w-4xl space-y-3">
          <h2 id="announcements-feed" className="sr-only">{t("feed")}</h2>
          {rows.length === 0 ? (
            <EmptyState icon={Megaphone} title={t("empty.feed")} description={t("empty.feedHint")} />
          ) : (
            rows.map((r) => <AnnouncementCard key={r.id} row={r} manage={false} />)
          )}
        </section>
      </div>
    );
  }

  const [rows, byRole] = await Promise.all([
    prisma.announcement.findMany({ orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }], select: announcementSelect }),
    prisma.user.groupBy({ by: ["role"], where: { active: true }, _count: { _all: true } }),
  ]);
  const active = new Map(byRole.map((g) => [g.role, g._count._all]));
  /** users notified when this draft is published: active users of the audience roles, minus the publisher (me) and the author */
  const recipients = (r: AnnouncementRow) => {
    const inAudience = (role: Role) => r.audience.includes(role);
    let n = r.audience.reduce((s, role) => s + (active.get(role) ?? 0), 0);
    if (inAudience("ADMIN")) n -= 1;
    if (r.author && r.author.id !== user.id && r.author.active && inAudience(r.author.role)) n -= 1;
    return Math.max(0, n);
  };
  const drafts = rows.filter((r) => r.status === "DRAFT");
  const published = rows.filter((r) => r.status === "PUBLISHED");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("descriptionAdmin")} actions={<AnnouncementDialog />} />
      <div className="max-w-4xl space-y-8">
        <section aria-labelledby="announcements-drafts" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="announcements-drafts" className="text-base font-semibold">{t("sections.drafts")}</h2>
            <p className="tabular text-xs text-muted-foreground">{t("count", { count: drafts.length })}</p>
          </div>
          {drafts.length === 0 ? (
            <EmptyState icon={FilePenLine} title={t("empty.drafts")} description={t("empty.draftsHint")} />
          ) : (
            drafts.map((r) => <AnnouncementCard key={r.id} row={r} manage recipients={recipients(r)} />)
          )}
        </section>
        <section aria-labelledby="announcements-published" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="announcements-published" className="text-base font-semibold">{t("sections.published")}</h2>
            <p className="tabular text-xs text-muted-foreground">{t("count", { count: published.length })}</p>
          </div>
          {published.length === 0 ? (
            <EmptyState icon={Megaphone} title={t("empty.published")} description={t("empty.publishedHint")} />
          ) : (
            published.map((r) => <AnnouncementCard key={r.id} row={r} manage />)
          )}
        </section>
      </div>
    </div>
  );
}
