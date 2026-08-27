import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "timer-alerts";
let channelReady = false;

async function ensureChannel() {
  if (channelReady || Platform.OS !== "android") {
    channelReady = true;
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Timer alerts",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
  channelReady = true;
}

/** Fires an immediate local notification -- sound + vibration via the
 *  device's own notification channel, the same mechanism reminders.ts
 *  already relies on, just triggered right now instead of scheduled for
 *  later. Used to mark an EMOM round flipping or a rest timer hitting
 *  zero, so it's noticeable even with the screen off or the app
 *  backgrounded (mid-set, phone in a pocket). */
export async function fireTimerAlert(title: string, body: string) {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
  });
}
