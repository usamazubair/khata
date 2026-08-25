import AsyncStorage from "@react-native-async-storage/async-storage";

const LOG_KEY = "khata_notification_log";
const MAX_ENTRIES = 50;

export type LoggedNotification = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
};

/** A history of notifications the app has actually seen delivered. This can
 *  only capture what happens while Khata's JS is running — a notification
 *  that fires while the app is fully closed reaches the system tray same as
 *  ever, it just never passes through here. */
export async function logReceived(title: string, body: string) {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const log: LoggedNotification[] = raw ? JSON.parse(raw) : [];
    log.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, body, receivedAt: new Date().toISOString() });
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, MAX_ENTRIES)));
  } catch {
    // A missed log entry isn't worth failing over.
  }
}

export async function getLoggedNotifications(): Promise<LoggedNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
