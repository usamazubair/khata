/* Wall-clock helpers shared by the timetable screens and the reminders.
   Times are "HH:MM" and dates are "YYYY-MM-DD" — neither is turned into an
   instant, which is what keeps a 09:00 class at 09:00 in any timezone. */

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Postgres numbers weekdays 0 = Sunday; the picker reads Monday-first. */
export const WEEKDAYS = [
  { dow: 1, short: "Mon" },
  { dow: 2, short: "Tue" },
  { dow: 3, short: "Wed" },
  { dow: 4, short: "Thu" },
  { dow: 5, short: "Fri" },
  { dow: 6, short: "Sat" },
  { dow: 0, short: "Sun" },
] as const;

/** Shared with the web dashboard's palette, so an entry looks the same
 *  colour whichever side created it. */
export const EVENT_COLORS = ["#2f6bff", "#f4661f", "#00b37e", "#f0a500", "#e0459c", "#12b0c9", "#7b3ff2", "#e33b4e"];

export const REMINDER_OPTIONS = [
  { value: "", label: "None" },
  { value: "0", label: "At start" },
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "1440", label: "1 day" },
];

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
