import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api, money } from "../api";
import { FixedExpense } from "../types";

const PREFS_KEY = "khata_reminders";
const LEGACY_WORKOUT_KEY = "khata_workout_reminder";

// Two weeks of individually-scheduled days for the workout nudge. A repeating
// daily trigger would keep firing forever but can't skip a single day, and
// one-at-a-time would stop entirely if the app went unopened — this gives both
// resilience and the ability to drop the days you've already trained.
const WORKOUT_HORIZON_DAYS = 14;
// Bills are scheduled the same way, far enough ahead to cover this month's and
// next month's occurrence of everything.
const BILL_HORIZON_DAYS = 40;
// iOS silently drops anything past 64 pending notifications, so the bill half
// is capped and the soonest ones win.
const MAX_BILL_NOTIFICATIONS = 40;

export type TimePref = { enabled: boolean; hour: number; minute: number };
export type ReminderPrefs = { workout: TimePref; bills: TimePref };

const DEFAULTS: ReminderPrefs = {
  workout: { enabled: false, hour: 19, minute: 0 },
  bills: { enabled: false, hour: 10, minute: 0 },
};

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { workout: { ...DEFAULTS.workout, ...saved.workout }, bills: { ...DEFAULTS.bills, ...saved.bills } };
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

function localDateKey(d: Date) {
  // Local YYYY-MM-DD — toISOString would shift the day in non-UTC zones.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

/** Whether a session is already logged for today. A failure here (offline, no
 *  Workout access) is treated as "not trained", so you get the nudge rather
 *  than silently losing it. */
async function trainedToday(): Promise<boolean> {
  try {
    const today = localDateKey(new Date());
    const sessions = await api.workouts.sessions({ date_from: today, date_to: today });
    return Array.isArray(sessions) && sessions.length > 0;
  } catch {
    return false;
  }
}

async function ensureChannel(id: string, name: string) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function scheduleWorkout(pref: TimePref) {
  await ensureChannel("workout-reminders", "Workout reminders");
  const alreadyTrained = await trainedToday();
  const now = new Date();

  for (let i = 0; i < WORKOUT_HORIZON_DAYS; i++) {
    const when = new Date(now);
    when.setDate(now.getDate() + i);
    when.setHours(pref.hour, pref.minute, 0, 0);

    if (when <= now) continue; // today's slot has already passed
    if (i === 0 && alreadyTrained) continue; // don't nag on a day you trained

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Did you train today?",
        body: "No workout logged yet — open Khata to add one.",
        data: { screen: "workout" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: "workout-reminders",
      },
    });
  }
}

/** A bill's occurrence in a given month. Short months can't hold a 29th–31st,
 *  so those fall back to the month's last day rather than spilling into the
 *  next one. */
function occurrenceDate(bill: FixedExpense, year: number, monthIndex: number) {
  const day = Math.min(bill.due_day, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day);
}

async function scheduleBills(pref: TimePref) {
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
    // Offline, or no access to the Transactions module. Nothing is scheduled
    // this round; the next foreground refresh retries with fresh data.
    return;
  }

  const horizon = new Date(now);
  horizon.setDate(now.getDate() + BILL_HORIZON_DAYS);

  type Planned = { when: Date; title: string; body: string };
  const planned: Planned[] = [];

  const plan = (bills: FixedExpense[], year: number, monthIndex: number) => {
    for (const bill of bills) {
      if (!bill.active) continue;
      if (bill.status === "paid") continue;

      const due = occurrenceDate(bill, year, monthIndex);
      const amount = money(bill.amount);

      const dayBefore = new Date(due);
      dayBefore.setDate(due.getDate() - 1);
      dayBefore.setHours(pref.hour, pref.minute, 0, 0);
      planned.push({
        when: dayBefore,
        title: `${bill.name} is due tomorrow`,
        body: `${amount} — due ${due.toLocaleDateString(undefined, { day: "numeric", month: "long" })}.`,
      });

      const onTheDay = new Date(due);
      onTheDay.setHours(pref.hour, pref.minute, 0, 0);
      planned.push({
        when: onTheDay,
        title: `${bill.name} is due today`,
        body: `${amount} — still not logged as paid.`,
      });
    }
  };

  plan(thisMonth, now.getFullYear(), now.getMonth());
  plan(nextMonth, nextMonthDate.getFullYear(), nextMonthDate.getMonth());

  const upcoming = planned
    .filter((p) => p.when > now && p.when <= horizon)
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, MAX_BILL_NOTIFICATIONS);

  if (!upcoming.length) return;
  await ensureChannel("bill-reminders", "Bill reminders");

  for (const p of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { screen: "transactions" } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.when,
        channelId: "bill-reminders",
      },
    });
  }
}

/** Rebuilds the whole schedule — workout and bills together, because the only
 *  way to drop a stale reminder is to cancel everything and re-derive from
 *  what the server currently says. Called on launch, when the app returns to
 *  the foreground, after a session or transaction is logged, and when the
 *  settings change. */
export async function refreshReminders() {
  const prefs = await getReminderPrefs();
  const wanted = prefs.workout.enabled || prefs.bills.enabled;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!wanted) return;
  if (!(await ensurePermission())) return;

  if (prefs.workout.enabled) await scheduleWorkout(prefs.workout);
  if (prefs.bills.enabled) await scheduleBills(prefs.bills);
}

export function formatTimePref({ hour, minute }: TimePref) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
