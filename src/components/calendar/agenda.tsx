import Link from "next/link";
import { addDays, format, isSameDay } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { Flag, ListChecks, MessagesSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import { DayChip, MiniEmpty } from "@/components/dashboard/parts";
import { programWeekOf, weekStart } from "./program";
import { PROGRAM } from "@/lib/constants";

export type AgendaKind = "session" | "sessionGroup" | "task" | "taskGroup" | "deadline" | "milestone";
export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  date: Date;
  title: string;
  sub?: string;
  href: string;
  /** show time (sessions) */
  timed?: boolean;
  badge?: React.ReactNode;
  overdue?: boolean;
};

const ICON = { session: MessagesSquare, sessionGroup: MessagesSquare, task: ListChecks, taskGroup: ListChecks, deadline: Trophy, milestone: Flag } as const;
const ICON_TONE: Record<AgendaKind, string> = {
  session: "bg-info-soft text-info",
  sessionGroup: "bg-info-soft text-info",
  task: "bg-neutral-soft text-neutral",
  taskGroup: "bg-neutral-soft text-neutral",
  deadline: "bg-warning-soft text-warning",
  milestone: "bg-accent text-accent-foreground",
};

/** Agenda grouped by calendar week (Mon–Sun), then by day. */
export async function Agenda({ items, emptyText }: { items: AgendaItem[]; emptyText: string }) {
  const [t, locale] = await Promise.all([getTranslations("calendar"), getLocale()]);
  if (items.length === 0) return <MiniEmpty>{emptyText}</MiniEmpty>;
  const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime());
  const weeks = new Map<number, AgendaItem[]>();
  for (const it of sorted) {
    const k = weekStart(it.date).getTime();
    weeks.set(k, [...(weeks.get(k) ?? []), it]);
  }
  const today = new Date();

  return (
    <div className="space-y-6">
      {[...weeks.entries()].map(([ws, list]) => {
        const start = new Date(ws);
        const pw = programWeekOf(addDays(start, 3));
        const days: { day: Date; items: AgendaItem[] }[] = [];
        for (const it of list) {
          const last = days[days.length - 1];
          if (last && isSameDay(last.day, it.date)) last.items.push(it);
          else days.push({ day: it.date, items: [it] });
        }
        return (
          <section key={ws} aria-label={t("agenda.weekOf", { range: `${fmtDay(start, locale)} – ${fmtDay(addDays(start, 6), locale)}` })}>
            <h3 className="sticky top-14 z-10 -mx-1 flex items-baseline gap-2 bg-card/95 px-1 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground backdrop-blur">
              <span>{t("agenda.weekOf", { range: `${fmtDay(start, locale)} – ${fmtDay(addDays(start, 6), locale)}` })}</span>
              {pw >= 1 && pw <= PROGRAM.incubationWeeks && <span className="rounded bg-accent px-1.5 py-px text-[11px] text-accent-foreground">{t("agenda.programWeek", { n: pw })}</span>}
              <span className="ml-auto font-normal">{t("agenda.items", { count: list.length })}</span>
            </h3>
            <ol className="mt-1 divide-y">
              {days.map(({ day, items: dayItems }) => (
                <li key={day.toISOString()} className="flex gap-3 py-2.5">
                  <DayChip date={day} locale={locale} highlight={isSameDay(day, today)} className="mt-0.5" />
                  <ul className="min-w-0 flex-1 space-y-0.5">
                    {dayItems.map((it) => {
                      const Icon = ICON[it.kind];
                      return (
                        <li key={it.id}>
                          <Link
                            href={it.href}
                            className="-mx-2 flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", ICON_TONE[it.kind])} aria-hidden>
                              <Icon className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-sm font-medium", it.overdue && "text-danger")}>{it.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                <span className="sr-only">{t(`kinds.${it.kind}`)} · </span>
                                {it.timed && <span className="tabular">{format(it.date, "HH:mm")} · </span>}
                                {it.sub}
                              </span>
                            </span>
                            {it.badge && <span className="hidden shrink-0 sm:inline-flex">{it.badge}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
