/* Shared timetable arithmetic. Times are wall-clock "HH:MM" strings and dates
   are calendar "YYYY-MM-DD" strings — neither is ever turned into an instant,
   which is what keeps a 09:00 class at 09:00 regardless of timezone. */

/** Postgres numbers weekdays 0 = Sunday; the grid reads Monday-first. */
export const WEEKDAYS = [
  { dow: 1, short: "Mon", long: "Monday" },
  { dow: 2, short: "Tue", long: "Tuesday" },
  { dow: 3, short: "Wed", long: "Wednesday" },
  { dow: 4, short: "Thu", long: "Thursday" },
  { dow: 5, short: "Fri", long: "Friday" },
  { dow: 6, short: "Sat", long: "Saturday" },
  { dow: 0, short: "Sun", long: "Sunday" },
] as const;

export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "0", label: "When it starts" },
  { value: "5", label: "5 minutes before" },
  { value: "10", label: "10 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
];

export const EVENT_COLORS = ["#2f6bff", "#f4661f", "#00b37e", "#f0a500", "#e0459c", "#12b0c9", "#7b3ff2", "#e33b4e"];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

/** "14:30" → "2:30 PM" in the reader's locale. */
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

/** The Monday on or before `d`. */
export function startOfWeek(d: Date) {
  const day = d.getDay(); // 0 = Sunday
  return addDays(d, day === 0 ? -6 : 1 - day);
}

export function weekLabel(monday: Date) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const left = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = sunday.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${left} – ${right}, ${sunday.getFullYear()}`;
}

/** Which entries land on a given day of a given week: the weekly repeats for
 *  that weekday, plus any one-off dated to it. */
export function eventsOnDay<T extends { day_of_week: number; event_date: string | null }>(
  events: T[],
  dow: number,
  date: string
) {
  return events.filter((e) => (e.event_date ? e.event_date === date : e.day_of_week === dow));
}

/** Side-by-side placement for entries that overlap in time.
 *
 *  Events are swept in start order and gathered into clusters — runs where
 *  each entry overlaps something still open. Within a cluster an entry takes
 *  the lowest column no still-running neighbour is using, and every member of
 *  the cluster is then widened to the same column count so the blocks line up
 *  instead of each one guessing its own width. */
export function layoutDay<T extends { starts_at: string; ends_at: string }>(events: T[]) {
  const sorted = [...events].sort(
    (a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at) || toMinutes(a.ends_at) - toMinutes(b.ends_at)
  );

  const placed: { item: T; col: number; cols: number }[] = [];
  let cluster: { item: T; col: number; cols: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = cluster.reduce((n, c) => Math.max(n, c.col + 1), 1);
    for (const c of cluster) c.cols = cols;
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    const start = toMinutes(item.starts_at);
    if (cluster.length && start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => toMinutes(c.item.ends_at) > start).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, toMinutes(item.ends_at));
  }
  if (cluster.length) flush();
  return placed;
}

/** The hour range worth drawing: wide enough for everything scheduled, but
 *  never so tall that an empty week is mostly blank rows. */
export function hourRange<T extends { starts_at: string; ends_at: string }>(events: T[]) {
  let from = 7;
  let to = 20;
  for (const e of events) {
    from = Math.min(from, Math.floor(toMinutes(e.starts_at) / 60));
    to = Math.max(to, Math.ceil(toMinutes(e.ends_at) / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 4)) };
}
