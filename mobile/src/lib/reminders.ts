import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "../api";

const PREFS_KEY = "khata_workout_reminder";
// Two weeks of individually-scheduled days. A repeating daily trigger would
// keep firing forever but can't skip a single day, and one-at-a-time would
// stop entirely if the app went unopened — this gives both resilience and the
// ability to drop the days you've already trained.
const HORIZON_DAYS = 14;

export type ReminderPrefs = { enabled: boolean; hour: number; minute: number };

const DEFAULTS: ReminderPrefs = { enabled: false, hour: 19, minute: 0 };

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function setReminderPrefs(prefs: ReminderPrefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await refreshWorkoutReminder();
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

/** Rebuilds the whole schedule. Called on launch, when the app returns to the
 *  foreground, after a session is logged, and when the settings change. */
export async function refreshWorkoutReminder() {
  const prefs = await getReminderPrefs();

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;
  if (!(await ensurePermission())) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("workout-reminders", {
      name: "Workout reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const alreadyTrained = await trainedToday();
  const now = new Date();

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const when = new Date(now);
    when.setDate(now.getDate() + i);
    when.setHours(prefs.hour, prefs.minute, 0, 0);

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

export function formatReminderTime({ hour, minute }: ReminderPrefs) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
