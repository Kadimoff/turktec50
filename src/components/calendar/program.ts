// Program timeline derived from PROGRAM / PHASES constants (shared by dashboard + calendar).
// Every day / week / month boundary is a Baku calendar boundary (src/lib/dates.ts), independent of the server time zone.
import { PHASES, PROGRAM, currentMonth, currentWeek } from "@/lib/constants";
import { bakuAddDays, bakuDaysUntil, bakuParts, bakuStartOfDay, parseBakuDate } from "@/lib/dates";
import { fmtBaku, fmtDay } from "@/lib/format";

export const DAY_MS = 24 * 3600 * 1000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** Same Baku wall-clock time `months` calendar months later (day clamped to the month's last day, like date-fns). */
function bakuAddMonths(d: Date, months: number) {
  const p = bakuParts(d);
  const idx = p.m - 1 + months;
  const y = p.y + Math.floor(idx / 12);
  const m = idx - Math.floor(idx / 12) * 12; // 0..11
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return parseBakuDate(`${y}-${p2(m + 1)}-${p2(Math.min(p.d, lastDay))}`, `${p2(p.hh)}:${p2(p.mm)}`)!;
}

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
    const start = bakuAddMonths(PROGRAM.start, p.month - 1);
    const end = p.month === PHASES.length ? PROGRAM.end : bakuAddDays(bakuAddMonths(PROGRAM.start, p.month), -1);
    const state: PhaseView["state"] = after || (!before && p.month < cm) ? "done" : !before && p.month === cm ? "current" : "next";
    return { key: p.key, month: p.month, start, end, state };
  });
}

export type WeekView = { week: number; start: Date; end: Date; state: "done" | "current" | "next" };

export function incubationWeeks(now = new Date()): WeekView[] {
  const cw = currentWeek(now);
  const incEnd = bakuAddDays(PROGRAM.incubationStart, PROGRAM.incubationWeeks * 7);
  const finished = now >= incEnd;
  return Array.from({ length: PROGRAM.incubationWeeks }, (_, i) => {
    const w = i + 1;
    const start = bakuAddDays(PROGRAM.incubationStart, i * 7);
    const end = bakuAddDays(start, 6);
    const state: WeekView["state"] = finished || w < cw ? "done" : w === cw ? "current" : "next";
    return { week: w, start, end, state };
  });
}

export function incubationEnd() {
  return bakuAddDays(PROGRAM.incubationStart, PROGRAM.incubationWeeks * 7 - 1);
}

/** Program week (1-based, may exceed 8 or be <1) of a date relative to incubation start (a Baku midnight). */
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
  const s = fmtBaku(d, "LLLL yyyy", locale);
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

export function rangeLabel(a: Date, b: Date, locale: string) {
  return `${fmtDay(a, locale)} – ${fmtDay(b, locale)}`;
}

/** Baku calendar days until `d` (0 = today, negative = past). */
export function daysUntil(d: Date, now = new Date()) {
  return bakuDaysUntil(d, now);
}

/** Monday 00:00 (Baku) of the Baku calendar week containing `d`. */
export function weekStart(d: Date) {
  const day = bakuStartOfDay(d);
  return bakuAddDays(day, -((bakuParts(day).dow + 6) % 7));
}
