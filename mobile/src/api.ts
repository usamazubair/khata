import AsyncStorage from "@react-native-async-storage/async-storage";

const URL_KEY = "khata_api_url";
const KEY_KEY = "khata_api_key";

export async function getServerConfig() {
  const [url, key] = await Promise.all([AsyncStorage.getItem(URL_KEY), AsyncStorage.getItem(KEY_KEY)]);
  return { url: url || "", key: key || "" };
}

export async function setServerConfig(url: string, key: string) {
  await AsyncStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
  await AsyncStorage.setItem(KEY_KEY, key.trim());
}

export class ApiNotConfiguredError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free-tier hosts (e.g. Render) sometimes 404 with a plain-text body for a
// beat while a sleeping instance wakes up, before routing settles. Our own
// routes always answer with JSON, so a non-JSON error response is almost
// certainly that transient state rather than a real app error — worth a
// couple of quick retries instead of surfacing it to the user.
function looksLikeInfraHiccup(res: Response) {
  return !res.headers.get("content-type")?.includes("application/json");
}

async function request(path: string, options: RequestInit = {}, attempt = 1): Promise<any> {
  const { url, key } = await getServerConfig();
  if (!url || !key) throw new ApiNotConfiguredError("Set the server URL and key in Settings first.");

  const res = await fetch(`${url}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      ...options.headers,
    },
  });

  if (!res.ok && looksLikeInfraHiccup(res) && attempt < 3) {
    await sleep(attempt * 1500);
    return request(path, options, attempt + 1);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: (url: string) => fetch(`${url}/api/health`).then((r) => r.ok),

  // Categories, fixed bills, goals, and budgets are managed from the web
  // dashboard. The app only reads categories (to log transactions against
  // them) and reads budgets/goals (to show progress on Insights).
  categories: {
    list: (type?: string) => request(`/api/categories?${new URLSearchParams({ ...(type ? { type } : {}), active: "true" }).toString()}`),
  },

  transactions: {
    list: (params: Record<string, string> = {}) =>
      request(`/api/transactions?${new URLSearchParams(params).toString()}`),
    create: (body: object) => request("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/transactions/${id}`, { method: "DELETE" }),
  },

  budgets: {
    list: (month: string) => request(`/api/budgets?${new URLSearchParams({ month, active: "true" }).toString()}`),
  },

  goals: {
    list: () => request(`/api/goals?active=true`),
  },

  summary: (month: string) => request(`/api/summary?month=${month}`),
};

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function money(n: number | string) {
  const num = Number(n);
  return "Rs " + num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 2 : 0 });
}
