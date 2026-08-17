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

async function request(path: string, options: RequestInit = {}) {
  const { url, key } = await getServerConfig();
  if (!url || !key) throw new ApiNotConfiguredError("Set the server URL and key in Settings first.");

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      ...options.headers,
    },
  });

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

  categories: {
    list: () => request("/api/categories"),
    create: (body: object) => request("/api/categories", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/categories/${id}`, { method: "DELETE" }),
  },

  transactions: {
    list: (params: Record<string, string> = {}) =>
      request(`/api/transactions?${new URLSearchParams(params).toString()}`),
    create: (body: object) => request("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/transactions/${id}`, { method: "DELETE" }),
  },

  fixedExpenses: {
    list: (month: string) => request(`/api/fixed-expenses?month=${month}`),
    create: (body: object) => request("/api/fixed-expenses", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/fixed-expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/fixed-expenses/${id}`, { method: "DELETE" }),
    confirm: (id: number) => request(`/api/fixed-expenses/${id}/confirm`, { method: "POST", body: JSON.stringify({}) }),
  },

  budgets: {
    list: (month: string) => request(`/api/budgets?month=${month}`),
    upsert: (body: object) => request("/api/budgets", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/budgets/${id}`, { method: "DELETE" }),
  },

  goals: {
    list: () => request("/api/goals"),
    create: (body: object) => request("/api/goals", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/goals/${id}`, { method: "DELETE" }),
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
