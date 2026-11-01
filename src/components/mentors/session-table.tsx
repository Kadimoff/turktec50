"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Video } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DateTile, SessionActions, SessionStatusBadge } from "./session-card";
import type { SessionItem } from "./types";

/** Compact sessions table (md+) with stacked rows on mobile. */
export function SessionTable({ sessions, caption }: { sessions: SessionItem[]; caption: string }) {
  const t = useTranslations("mentors");
  const th = "text-xs font-semibold text-muted-foreground";
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${th} pl-4`}>{t("columns.when")}</TableHead>
              <TableHead className={th}>{t("columns.topic")}</TableHead>
              <TableHead className={th}>{t("columns.project")}</TableHead>
              <TableHead className={th}>{t("columns.mentor")}</TableHead>
              <TableHead className={th}>{t("columns.status")}</TableHead>
              <TableHead className={`${th} pr-4 text-right`}>
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/50">
                <TableCell className="py-2.5 pl-4">
                  <p className="tabular text-sm font-medium">{s.whenAbs}</p>
                  <p className="text-xs text-muted-foreground">{s.whenRel}</p>
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <p className="text-sm font-medium text-pretty">{s.topic}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {s.online ? <Video className="size-3" aria-hidden /> : <MapPin className="size-3" aria-hidden />}
                    {s.online ? t("session.online") : t("session.inPerson")} · {t("session.duration", { min: s.durationMin })}
                  </p>
                </TableCell>
                <TableCell>
                  <Link href={`/projects/${s.projectId}/sessions`} className="font-mono text-xs font-semibold text-primary hover:underline">
                    {s.projectCode}
                  </Link>
                  <p className="max-w-40 truncate text-xs text-muted-foreground">{s.projectTitle}</p>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <UserAvatar name={s.mentor.name} size="sm" />
                    <span aria-hidden className="text-xs font-medium">{s.mentor.name}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <SessionStatusBadge session={s} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <SessionActions session={s} compact />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={caption}>
        {sessions.map((s) => (
          <li key={s.id} className="flex gap-3 px-4 py-3">
            <DateTile session={s} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-pretty">{s.topic}</p>
                <SessionStatusBadge session={s} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <Link href={`/projects/${s.projectId}/sessions`} className="font-mono font-semibold text-primary">
                  {s.projectCode}
                </Link>{" "}
                · {s.mentor.name} · {s.whenRel}
              </p>
              <div className="mt-2">
                <SessionActions session={s} compact />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
