import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api, money } from "../api";
import { FixedExpense, TimetableOccurrence, TodoItem } from "../types";
import { atLocal, formatTime, isoDate } from "./schedule";

const PREFS_KEY = "khata_reminders";
const LEGACY_WORKOUT_KEY = "khata_workout_reminder";

// Everything is scheduled as individually-dated notifications rather than
// repeating triggers: a repeating trigger fires forever but can't skip the day
// you already trained or the bill you already paid, and a single next-one-only
// trigger stops dead if the app goes unopened. Rebuilding a rolling window on
// every foreground gives both.
const WORKOUT_HORIZON_DAYS = 14;
const BILL_HORIZON_DAYS = 40;
const TIMETABLE_HORIZON_DAYS = 14;
const TODO_HORIZON_DAYS = 30;

// iOS silently drops anything past 64 pending notifications. Rather than give
// each kind a fixed slice — which starves whichever you actually use most —
// everything is planned first, then the soonest 60 win.
const MAX_SCHEDULED = 60;

export type TimePref = { enabled: boolean; hour: number; minute: number };
export type TogglePref = { enabled: boolean };
export type ReminderPrefs = {
  workout: TimePref;
  bills: TimePref;
  /** Timetable entries carry their own lead time, so there's no clock here. */
  timetable: TogglePref;
  todo: TimePref;
};

const DEFAULTS: ReminderPrefs = {
  workout: { enabled: false, hour: 19, minute: 0 },
  bills: { enabled: false, hour: 10, minute: 0 },
  timetable: { enabled: false },
  todo: { enabled: false, hour: 9, minute: 0 },
};

type Planned = { when: Date; title: string; body: string; channelId: string; screen: string };

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        workout: { ...DEFAULTS.workout, ...saved.workout },
        bills: { ...DEFAULTS.bills, ...saved.bills },
        timetable: { ...DEFAULTS.timetable, ...saved.timetable },
        todo: { ...DEFAULTS.todo, ...saved.todo },
      };
    }
    // Carry over the flat workout-only shape this replaced.
    const legacy = await AsyncStorage.getItem(LEGACY_WORKOUT_KEY);
    if (legacy) return { ...DEFAULTS, workout: { ...DEFAULTS.workout, ...JSON.parse(legacy) } };
    return DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function setReminderPrefs(prefs: ReminderPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await refreshReminders();
}

/** Foreground notifications are suppressed by default, which makes testing
 *  confusing — show them like any other. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

/** Whether a session is already logged for today. A failure here (offline, no
 *  Workout access) is treated as "not trained", so you get the nudge rather
 *  than silently losing it. */
async function trainedToday(): Promise<boolean> {
  try {
    const today = isoDate(new Date());
    const sessions = await api.workouts.sessions({ date_from: today, date_to: today });
    return Array.isArray(sessions) && sessions.length > 0;
  } catch {
    return false;
  }
}

async function planWorkout(pref: TimePref): Promise<Planned[]> {
  const alreadyTrained = await trainedToday();
  const now = new Date();
  const out: Planned[] = [];

  for (let i = 0; i < WORKOUT_HORIZON_DAYS; i++) {
    const when = new Date(now);
    when.setDate(now.getDate() + i);
    when.setHours(pref.hour, pref.minute, 0, 0);

    if (when <= now) continue; // today's slot has already passed
    if (i === 0 && alreadyTrained) continue; // don't nag on a day you trained

    out.push({
      when,
      title: "Did you train today?",
      body: "No workout logged yet — open Khata to add one.",
      channelId: "workout-reminders",
      screen: "workout",
    });
  }
  return out;
}

/** A bill's occurrence in a given month. Short months can't hold a 29th–31st,
 *  so those fall back to the month's last day rather than spilling into the
 *  next one. */
function occurrenceDate(bill: FixedExpense, year: number, monthIndex: number) {
  return new Date(year, monthIndex, Math.min(bill.due_day, daysInMonth(year, monthIndex)));
}

async function planBills(pref: TimePref): Promise<Planned[]> {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // This month tells us what's already settled; next month is always still
  // open, and gets re-checked on the next refresh once the month rolls over.
  let thisMonth: FixedExpense[] = [];
  let nextMonth: FixedExpense[] = [];
  try {
    [thisMonth, nextMonth] = await Promise.all([
      api.fixedExpenses.list(monthKey(now)),
      api.fixedExpenses.list(monthKey(nextMonthDate)),
    ]);
  } catch {
    // Offline, or no access to the Transactions module. Nothing is planned
    // this round; the next foreground refresh retries with fresh data.
    return [];
  }

  const horizon = new Date(now);
  horizon.setDate(now.getDate() + BILL_HORIZON_DAYS);
  const out: Planned[] = [];

  const plan = (bills: FixedExpense[], year: number, monthIndex: number) => {
    for (const bill of bills) {
      if (!bill.active || bill.status === "paid") continue;

      const due = occurrenceDate(bill, year, monthIndex);
      const amount = money(bill.amount);
      const dueLabel = due.toLocaleDateString(undefined, { day: "numeric", month: "long" });

      const dayBefore = new Date(due);
      dayBefore.setDate(due.getDate() - 1);
      dayBefore.setHours(pref.hour, pref.minute, 0, 0);
      out.push({
        when: dayBefore,
        title: `${bill.name} is due tomorrow`,
        body: `${amount} — due ${dueLabel}.`,
        channelId: "bill-reminders",
        screen: "transactions",
      });

      const onTheDay = new Date(due);
      onTheDay.setHours(pref.hour, pref.minute, 0, 0);
      out.push({
        when: onTheDay,
        title: `${bill.name} is due today`,
        body: `${amount} — still not logged as paid.`,
        channelId: "bill-reminders",
        screen: "transactions",
      });
    }
  };

  plan(thisMonth, now.getFullYear(), now.getMonth());
  plan(nextMonth, nextMonthDate.getFullYear(), nextMonthDate.getMonth());
  return out.filter((p) => p.when <= horizon);
}

function leadLabel(minutes: number) {
  if (minutes === 0) return "starting now";
  if (minutes < 60) return `in ${minutes} minutes`;
  if (minutes === 60) return "in an hour";
  if (minutes < 1440) return `in ${Math.round(minutes / 60)} hours`;
  return minutes === 1440 ? "tomorrow" : `in ${Math.round(minutes / 1440)} days`;
}

async function planTimetable(): Promise<Planned[]> {
  let occurrences: TimetableOccurrence[] = [];
  try {
    occurrences = await api.timetable.occurrences(isoDate(new Date()), TIMETABLE_HORIZON_DAYS);
  } catch {
    return [];
  }

  return occurrences
    .filter((o) => o.remind_minutes !== null)
    .map((o) => {
      // The lead time is per-entry, so the fire time is the start minus it.
      const start = atLocal(o.date, o.starts_at);
      const when = new Date(start.getTime() - (o.remind_minutes as number) * 60_000);
      const where = o.location ? ` · ${o.location}` : "";
      return {
        when,
        title: `${o.title} ${leadLabel(o.remind_minutes as number)}`,
        body: `${formatTime(o.starts_at)}–${formatTime(o.ends_at)}${where}`,
        channelId: "timetable-reminders",
        screen: "timetable",
      };
    });
}

async function planTodo(pref: TimePref): Promise<Planned[]> {
  let items: TodoItem[] = [];
  try {
    items = await api.todo.items({ done: "false" });
  } catch {
    return [];
  }

  const now = new Date();
  const today = isoDate(now);
  const hhmm = `${String(pref.hour).padStart(2, "0")}:${String(pref.minute).padStart(2, "0")}`;
  const horizon = new Date(now);
  horizon.setDate(now.getDate() + TODO_HORIZON_DAYS);

  const out: Planned[] = [];
  for (const item of items) {
    if (!item.due_date) continue; // nothing dated, nothing to remind about

    // An overdue task nags again today rather than staying silent forever —
    // its own due date has already passed, so that's the only day left that
    // makes sense to fire on. If today's slot has itself already passed
    // (the reminder hour was earlier than whenever this refresh happens to
    // run), fire shortly instead of skipping it outright until tomorrow —
    // the alternative is a day where an overdue task never nags at all
    // just because you opened the app in the afternoon.
    const targetDate = item.due_date < today ? today : item.due_date;
    let when = atLocal(targetDate, hhmm);
    if (targetDate === today && when <= now) when = new Date(now.getTime() + 60_000);
    if (when > horizon) continue;

    out.push({
      when,
      title: `${item.title} is due${item.due_date < today ? " (overdue)" : item.due_date === today ? " today" : ""}`,
      body: `On your ${item.list_name} list.`,
      channelId: "todo-reminders",
      screen: "todo",
    });
  }
  return out;
}

async function ensureChannel(id: string, name: string) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

const CHANNEL_NAMES: Record<string, string> = {
  "workout-reminders": "Workout reminders",
  "bill-reminders": "Bill reminders",
  "timetable-reminders": "Timetable reminders",
  "todo-reminders": "Todo reminders",
};

// refreshReminders() is triggered from several independent places — sign-in,
// foreground-return, the 15-minute timer, and a manual "Sync now". A slow
// Render wake-up can make one call take tens of seconds, long enough for a
// second trigger to fire before the first finishes; without this guard
// they'd run concurrently, each fetching its own view of the data and both
// cancelling-and-rescheduling, so whichever happened to finish last would
// silently win — even over a call working from fresher data. Coalescing
// concurrent calls into the one already in flight makes that impossible:
// every caller during that window observes the same, single result.
let inFlight: Promise<void> | null = null;

export function refreshReminders(): Promise<void> {
  if (!inFlight) {
    inFlight = doRefreshReminders().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Rebuilds the whole schedule. The only way to drop a stale reminder is to
 *  cancel everything and re-derive from what the server currently says, so
 *  that's what this does — on launch, on every return to the foreground,
 *  after something is logged, and whenever the settings change.
 *
 *  The cancel happens *last*, only once the replacement is fully computed —
 *  not first. Computing it means several network calls (bills, timetable
 *  occurrences), which can be slow, especially against a Render free-tier
 *  instance waking from sleep. A background refresh (the periodic timer, or
 *  a foreground-return that gets interrupted) can have its process frozen or
 *  killed by Android mid-fetch; if the old schedule had already been wiped
 *  at that point, you're left with nothing armed until the app is next
 *  opened — which is a real, reproducible way for reminders to silently
 *  stop firing after the app's been backgrounded a while. Cancelling last
 *  means that failure mode leaves the *previous* schedule intact instead. */
async function doRefreshReminders() {
  const prefs = await getReminderPrefs();
  const wanted =
    prefs.workout.enabled || prefs.bills.enabled || prefs.timetable.enabled || prefs.todo.enabled;

  if (!wanted) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  if (!(await ensurePermission())) return;

  const planned = (
    await Promise.all([
      prefs.workout.enabled ? planWorkout(prefs.workout) : [],
      prefs.bills.enabled ? planBills(prefs.bills) : [],
      prefs.timetable.enabled ? planTimetable() : [],
      prefs.todo.enabled ? planTodo(prefs.todo) : [],
    ])
  ).flat();

  const now = new Date();
  const upcoming = planned
    .filter((p) => p.when > now)
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, MAX_SCHEDULED);

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const id of new Set(upcoming.map((p) => p.channelId))) {
    await ensureChannel(id, CHANNEL_NAMES[id] ?? "Reminders");
  }

  for (const p of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { screen: p.screen } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.when,
        channelId: p.channelId,
      },
    });
  }
}

/** Everything currently armed with the OS, regardless of app state — a
 *  direct answer to "is my reminder actually scheduled", independent of
 *  whatever refreshReminders() last managed to complete. */
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

export function formatTimePref({ hour, minute }: TimePref) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
