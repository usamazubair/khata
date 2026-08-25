import AsyncStorage from "@react-native-async-storage/async-storage";
import { ParsedSmsTransaction } from "./smsParser";

const QUEUE_KEY = "khata_pending_sms";
const MERCHANT_MEMORY_KEY = "khata_sms_merchant_categories";

export type PendingSms = ParsedSmsTransaction & {
  /** The message body itself — SMS have no reliable unique ID on Android,
   *  and the exact text is a fine dedupe key: a real duplicate delivery
   *  (which does happen occasionally) is byte-identical, and two distinct
   *  purchases are never worded identically down to the timestamp. */
  id: string;
  detectedAt: string;
};

export async function getPending(): Promise<PendingSms[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setPending(items: PendingSms[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** Adds a freshly-parsed SMS to the queue. Returns false without adding it
 *  if an identical message is already sitting there — a second delivery of
 *  the same broadcast shouldn't produce a second review card. */
export async function enqueue(parsed: ParsedSmsTransaction): Promise<boolean> {
  const items = await getPending();
  if (items.some((i) => i.raw === parsed.raw)) return false;
  items.unshift({ ...parsed, id: parsed.raw, detectedAt: new Date().toISOString() });
  await setPending(items);
  return true;
}

/** Removes an item once it's been confirmed into a real transaction, or
 *  dismissed as not worth logging. */
export async function remove(id: string) {
  const items = await getPending();
  await setPending(items.filter((i) => i.id !== id));
}

/** Which expense category a merchant was filed under last time, so a
 *  recurring merchant (the same coffee shop, the same petrol station)
 *  pre-selects itself on every later confirm instead of asking again. */
export async function rememberCategory(merchant: string, categoryId: number) {
  try {
    const raw = await AsyncStorage.getItem(MERCHANT_MEMORY_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[merchant.toLowerCase()] = categoryId;
    await AsyncStorage.setItem(MERCHANT_MEMORY_KEY, JSON.stringify(map));
  } catch {
    // Losing the memory just means asking again next time — not worth failing over.
  }
}

export async function recalledCategory(merchant: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(MERCHANT_MEMORY_KEY);
    if (!raw) return null;
    const map: Record<string, number> = JSON.parse(raw);
    return map[merchant.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}
