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

  // Read-only here: bills are created and confirmed from the web dashboard,
  // the app only needs them to know what to remind you about.
  fixedExpenses: {
    list: (month: string) =>
      request(`/api/fixed-expenses?${new URLSearchParams({ month, active: "true" }).toString()}`),
  },

  budgets: {
    list: (month: string) => request(`/api/budgets?${new URLSearchParams({ month, active: "true" }).toString()}`),
  },

  goals: {
    list: () => request(`/api/goals?active=true`),
  },

  exercises: {
    list: (activeOnly = true) => request(`/api/exercises${activeOnly ? "?active=true" : ""}`),
    update: (id: number, body: object) => request(`/api/exercises/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    uploadSignature: (resource_type: "image" | "video") =>
      request("/api/exercises/upload-signature", { method: "POST", body: JSON.stringify({ resource_type }) }),
  },

  workouts: {
    summary: () => request("/api/workouts/summary"),
    sessions: (params: Record<string, string> = {}) =>
      request(`/api/workouts/sessions?${new URLSearchParams(params).toString()}`),
    session: (id: number) => request(`/api/workouts/sessions/${id}`),
    createSession: (body: object) =>
      request("/api/workouts/sessions", { method: "POST", body: JSON.stringify(body) }),
    updateSession: (id: number, body: object) =>
      request(`/api/workouts/sessions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    removeSession: (id: number) => request(`/api/workouts/sessions/${id}`, { method: "DELETE" }),
    addSet: (sessionId: number, body: object) =>
      request(`/api/workouts/sessions/${sessionId}/sets`, { method: "POST", body: JSON.stringify(body) }),
    updateSet: (id: number, body: object) =>
      request(`/api/workouts/sets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    removeSet: (id: number) => request(`/api/workouts/sets/${id}`, { method: "DELETE" }),
  },

  summary: (month: string) => request(`/api/summary?month=${month}`),

  // Entries are built on the web dashboard; the app reads the agenda and
  // schedules the reminders from it.
  timetable: {
    list: () => request(`/api/timetable?active=true`),
    occurrences: (from: string, days: number) =>
      request(`/api/timetable/occurrences?${new URLSearchParams({ from, days: String(days) }).toString()}`),
    create: (body: object) => request("/api/timetable", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: object) => request(`/api/timetable/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request(`/api/timetable/${id}`, { method: "DELETE" }),
  },

  // Lists are shaped on the web; tasks are read and written here, because
  // ticking things off is the whole point of having it on a phone.
  todo: {
    lists: () => request(`/api/todo/lists?active=true`),
    createList: (body: object) => request("/api/todo/lists", { method: "POST", body: JSON.stringify(body) }),
    items: (params: Record<string, string> = {}) =>
      request(`/api/todo/items?${new URLSearchParams(params).toString()}`),
    addItem: (body: object) => request("/api/todo/items", { method: "POST", body: JSON.stringify(body) }),
    updateItem: (id: number, body: object) =>
      request(`/api/todo/items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    removeItem: (id: number) => request(`/api/todo/items/${id}`, { method: "DELETE" }),
  },
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

/** A DATE column arrives as "YYYY-MM-DD" — a calendar date with no timezone.
 *  `new Date("2026-08-20")` reads that as UTC midnight, which lands on the
 *  19th anywhere west of Greenwich, so build it at local midnight instead.
 *  Full timestamps (created_at) still parse normally. */
export function parseDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function money(n: number | string) {
  const num = Number(n);
  return "Rs " + num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 2 : 0 });
}
