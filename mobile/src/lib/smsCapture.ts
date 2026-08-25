import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  checkIfHasSMSPermission,
  requestReadSMSPermission,
  startReadSMS,
  stopReadSMS,
} from "@maniac-tech/react-native-expo-read-sms";
import { parseSms } from "./smsParser";
import { enqueue } from "./smsQueue";

const ENABLED_KEY = "khata_sms_capture_enabled";
let listening = false;

export const smsCaptureAvailable = Platform.OS === "android";

export async function getSmsCaptureEnabled(): Promise<boolean> {
  if (!smsCaptureAvailable) return false;
  return (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("sms-transactions", {
    name: "Detected transactions",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

/** The library's listener parses two values out of the raw broadcast and
 *  hands back `"[+92xxxxxxxxxx, message body]"` as a single string rather
 *  than an object — split on the first comma only, since a message body
 *  routinely contains commas of its own (amounts, addresses). */
function splitSmsPayload(sms: string): string {
  const withoutBrackets = sms.replace(/^\[|\]$/g, "");
  const comma = withoutBrackets.indexOf(",");
  return comma === -1 ? withoutBrackets : withoutBrackets.slice(comma + 1).trim();
}

async function handleIncoming(sms: string) {
  const body = splitSmsPayload(sms);
  const parsed = parseSms(body);
  if (!parsed) return;

  const added = await enqueue(parsed);
  if (!added) return;

  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Rs ${parsed.amount.toLocaleString()} at ${parsed.merchant}`,
      body: "Detected from a bank SMS — tap to review and log it.",
      data: { screen: "smsReview" },
    },
    trigger: Platform.OS === "android" ? { channelId: "sms-transactions" } : null,
  });
}

/** Starts (or confirms) the live listener. Only catches SMS that arrive
 *  while Khata's process is alive — the underlying library registers a
 *  receiver tied to the running app, not a system-level one, so a message
 *  that arrives while the app has been fully killed by Android is missed.
 *  Keeping the app installed and not force-stopped (and, on aggressive
 *  OEMs like Xiaomi/Oppo/Vivo, exempting it from battery optimisation) is
 *  what makes this reliable in practice. */
export async function startSmsCapture(): Promise<{ ok: boolean; reason?: string }> {
  if (!smsCaptureAvailable) return { ok: false, reason: "Android only." };

  const granted = await requestReadSMSPermission();
  if (!granted) return { ok: false, reason: "SMS permission was not granted." };

  await AsyncStorage.setItem(ENABLED_KEY, "true");
  if (listening) return { ok: true };

  await new Promise<void>((resolve) => {
    startReadSMS((status: string, sms: string) => {
      if (status === "success" && sms) handleIncoming(sms);
      resolve();
    });
  });
  listening = true;
  return { ok: true };
}

export async function stopSmsCapture() {
  await AsyncStorage.setItem(ENABLED_KEY, "false");
  if (listening) {
    stopReadSMS();
    listening = false;
  }
}

/** Re-arms the listener if it's meant to be on but isn't currently
 *  running — mirrors the reminders module's pattern of re-syncing on
 *  sign-in and foreground rather than assuming state survived. */
export async function resumeSmsCaptureIfEnabled() {
  if (!(await getSmsCaptureEnabled())) return;
  const perms = await checkIfHasSMSPermission();
  if (!perms.hasReadSmsPermission || !perms.hasReceiveSmsPermission) return;
  if (listening) return;
  await startSmsCapture();
}
