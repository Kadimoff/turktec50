import { getLocale, getTranslations } from "next-intl/server";
import { UsersRound } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { EnumBadge } from "@/components/shared/enum-badge";
import { AnnouncementActions, AnnouncementDialog } from "./announcement-dialogs";
import { ROLES } from "./types";

export const announcementSelect = {
  id: true, title: true, body: true, status: true, audience: true, publishedAt: true, updatedAt: true,
  author: { select: { id: true, name: true, role: true, active: true } },
} satisfies Prisma.AnnouncementSelect;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{ select: typeof announcementSelect }>;

/**
 * One announcement. The body is plain text: rendered as a text node with `whitespace-pre-line` (never as HTML).
 * `manage` (ADMIN) adds status, audience and the edit / publish / delete actions; `recipients` = users notified on publish.
 */
export async function AnnouncementCard({ row, manage, recipients = 0 }: { row: AnnouncementRow; manage: boolean; recipients?: number }) {
  const [t, te, locale] = await Promise.all([getTranslations("announcements"), getTranslations("enums"), getLocale()]);
  const published = row.status === "PUBLISHED" && row.publishedAt;
  const headingId = `announcement-${row.id}`;
  return (
    <article aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 id={headingId} className="text-base font-semibold text-pretty break-words">{row.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {published ? (
              <time dateTime={row.publishedAt!.toISOString()} title={fmtDateTime(row.publishedAt, locale)}>
                {t("publishedAt", { date: fmtDateTime(row.publishedAt, locale), relative: fmtRelative(row.publishedAt!, locale) })}
              </time>
            ) : (
              <time dateTime={row.updatedAt.toISOString()} title={fmtDateTime(row.updatedAt, locale)}>
                {t("draftUpdated", { relative: fmtRelative(row.updatedAt, locale) })}
              </time>
            )}
            {row.author && <> · {t("by", { name: row.author.name })}</>}
          </p>
        </div>
        {manage && <EnumBadge enumName="AnnouncementStatus" value={row.status} />}
      </header>

      {manage && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <UsersRound className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium text-muted-foreground">{t("audience")}:</span>
          <ul className="flex flex-wrap gap-1.5" aria-label={t("audience")}>
            {ROLES.filter((r) => row.audience.includes(r)).map((r) => (
              <li key={r} className="rounded-full border bg-muted/60 px-2 py-0.5 font-medium">{te(`Role.${r}`)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">{row.body}</p>

      {manage && (
        <footer className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t pt-3">
          <AnnouncementDialog announcement={{ id: row.id, title: row.title, body: row.body, audience: row.audience }} />
          <AnnouncementActions id={row.id} title={row.title} published={row.status === "PUBLISHED"} recipients={recipients} />
        </footer>
      )}
    </article>
  );
}
