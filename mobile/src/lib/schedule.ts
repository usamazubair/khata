/* Wall-clock helpers shared by the timetable screens and the reminders.
   Times are "HH:MM" and dates are "YYYY-MM-DD" — neither is turned into an
   instant, which is what keeps a 09:00 class at 09:00 in any timezone. */

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function duration(starts: string, ends: string) {
  const mins = toMinutes(ends) - toMinutes(starts);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

/** Local calendar date as YYYY-MM-DD — toISOString would shift the day. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** The Date for a "YYYY-MM-DD" plus "HH:MM", built at local time. */
export function atLocal(dateIso: string, hhmm: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function dayLabel(dateIso: string) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  if (dateIso === today) return "Today";
  if (dateIso === tomorrow) return "Tomorrow";
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
