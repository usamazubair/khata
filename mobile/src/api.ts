import AsyncStorage from "@react-native-async-storage/async-storage";

const URL_KEY = "khata_api_url";
const TOKEN_KEY = "khata_token";

export async function getServerUrl() {
  return (await AsyncStorage.getItem(URL_KEY)) || "";
}

export async function setServerUrl(url: string) {
  await AsyncStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
}

export async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiNotConfiguredError extends Error {}
export class UnauthorizedError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free-tier hosts (e.g. Render) sometimes 404 with a plain-text body for a
// beat while a sleeping instance wakes up, before routing settles. Our own
// routes always answer with JSON, so a non-JSON error response is almost
// certainly that transient state rather than a real app error — worth a
// couple of quick retries instead of surfacing it to the user.
function looksLikeInfraHiccup(res: Response) {
  return !res.headers.get("content-type")?.includes("application/json");
}

// Set by App.tsx so an expired session can bounce straight back to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request(path: string, options: RequestInit = {}, attempt = 1): Promise<any> {
  const [url, token] = await Promise.all([getServerUrl(), getToken()]);
  if (!url) throw new ApiNotConfiguredError("Set the server address first.");

  const res = await fetch(`${url}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    await clearToken();
    onUnauthorized?.();
    throw new UnauthorizedError("Your session expired. Sign in again.");
  }

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

  // Login is the one call that runs before a token exists.
  login: async (url: string, email: string, password: string) => {
    const res = await fetch(`${url.trim().replace(/\/+$/, "")}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign in failed.");
    return data as { token: string; user: User };
  },

  me: () => request("/api/auth/me"),
  modules: () => request("/api/modules"),

  changePassword: (current_password: string, new_password: string) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  // Categories, fixed bills, goals, and budgets are managed from the web
  // dashboard. The app only reads them; it reads+writes transactions.
  categories: {
    list: (type?: string) =>
      request(`/api/categories?${new URLSearchParams({ ...(type ? { type } : {}), active: "true" }).toString()}`),
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

export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  active: boolean;
};

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function money(n: number | string) {
  const num = Number(n);
  return "Rs " + num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 2 : 0 });
}
