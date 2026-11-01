// Program timeline derived from PROGRAM / PHASES constants (shared by dashboard + calendar).
import { addDays, addMonths, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { PHASES, PROGRAM, currentMonth, currentWeek } from "@/lib/constants";
import { dfLocale, fmtDay } from "@/lib/format";

export const DAY_MS = 24 * 3600 * 1000;

export type PhaseView = {
  key: (typeof PHASES)[number]["key"];
  month: number;
  start: Date;
  end: Date;
  state: "done" | "current" | "next";
};

export function programPhases(now = new Date()): PhaseView[] {
  const cm = currentMonth(now);
  const before = now < PROGRAM.start;
  const after = now > PROGRAM.end;
  return PHASES.map((p) => {
    const start = addMonths(PROGRAM.start, p.month - 1);
    const end = p.month === PHASES.length ? PROGRAM.end : addDays(addMonths(PROGRAM.start, p.month), -1);
    const state: PhaseView["state"] = after || (!before && p.month < cm) ? "done" : !before && p.month === cm ? "current" : "next";
    return { key: p.key, month: p.month, start, end, state };
  });
}

export type WeekView = { week: number; start: Date; end: Date; state: "done" | "current" | "next" };

export function incubationWeeks(now = new Date()): WeekView[] {
  const cw = currentWeek(now);
  const incEnd = addDays(PROGRAM.incubationStart, PROGRAM.incubationWeeks * 7);
  const finished = now >= incEnd;
  return Array.from({ length: PROGRAM.incubationWeeks }, (_, i) => {
    const w = i + 1;
    const start = addDays(PROGRAM.incubationStart, i * 7);
    const end = addDays(start, 6);
    const state: WeekView["state"] = finished || w < cw ? "done" : w === cw ? "current" : "next";
    return { week: w, start, end, state };
  });
}

export function incubationEnd() {
  return addDays(PROGRAM.incubationStart, PROGRAM.incubationWeeks * 7 - 1);
}

/** Program week (1-based, may exceed 8 or be <1) of a date relative to incubation start. */
export function programWeekOf(d: Date) {
  return Math.floor((d.getTime() - PROGRAM.incubationStart.getTime()) / (7 * DAY_MS)) + 1;
}

export type MilestoneKey = "programStart" | "incubationStart" | "midtermJury" | "incubationEnd" | "mockFinal" | "programEnd";

export function programMilestones(): { key: MilestoneKey; date: Date }[] {
  return [
    { key: "programStart", date: PROGRAM.start },
    { key: "incubationStart", date: PROGRAM.incubationStart },
    { key: "midtermJury", date: PROGRAM.midtermJury },
    { key: "incubationEnd", date: incubationEnd() },
    { key: "mockFinal", date: PROGRAM.mockFinal },
    { key: "programEnd", date: PROGRAM.end },
  ];
}

export function monthLabel(d: Date, locale: string) {
  const s = format(d, "LLLL yyyy", { locale: dfLocale(locale) });
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

export function rangeLabel(a: Date, b: Date, locale: string) {
  return `${fmtDay(a, locale)} – ${fmtDay(b, locale)}`;
}

export function daysUntil(d: Date, now = new Date()) {
  return differenceInCalendarDays(d, now);
}

export function weekStart(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}
