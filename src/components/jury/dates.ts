import { differenceInCalendarDays } from "date-fns";

/** Calendar days from today until `date` (negative when past). */
export function daysUntil(date: Date, now = new Date()) {
  return differenceInCalendarDays(date, now);
}
