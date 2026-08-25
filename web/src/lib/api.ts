const TOKEN_KEY = "khata_token";

export class UnauthorizedError extends Error {}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A sleeping free-tier host can answer with a plain-text 404 for a beat while
// it wakes up. Our routes always return JSON, so a non-JSON error body means
// the request never reached the app — worth retrying rather than surfacing.
const looksLikeInfraHiccup = (res: Response) =>
  !(res.headers.get("content-type") ?? "").includes("application/json");

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  attempt = 1
): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new UnauthorizedError("Your session expired. Sign in again.");
  }

  if (!res.ok && looksLikeInfraHiccup(res) && attempt < 3) {
    await sleep(attempt * 1500);
    return api<T>(path, options, attempt + 1);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the status-code message */
    }
    throw new Error(message);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path: string) => api<null>(path, { method: "DELETE" });

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Sign in failed.");
  return data as { token: string; user: import("./types").User };
}

/* ── formatting ────────────────────────────────────────────────────────── */

export function money(n: number | string) {
  const num = Number(n) || 0;
  return "Rs " + num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 2 : 0 });
}

// Workout weights are kg — money() would wrongly prefix them with "Rs".
export function kg(n: number | string) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** A DATE column arrives as "YYYY-MM-DD" — a calendar date with no timezone.
 *  `new Date("2026-08-20")` reads that as UTC midnight, which lands on the
 *  19th anywhere west of Greenwich, so build it at local midnight instead.
 *  Full timestamps (created_at) still parse normally. */
export function parseDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function shortDate(iso: string) {
  return parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fullDate(iso: string) {
  return parseDate(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Stored category hex -> its dark-mode step. Both the current swatches and the
// ones earlier categories were saved with are listed, so older rows keep
// adapting instead of falling back to a colour tuned for a light ground.
const DARK_STEP: Record<string, string> = {
  // current palette
  "#2f6bff": "#5b86ff",
  "#f4661f": "#ff8043",
  "#00b37e": "#16c791",
  "#f0a500": "#ffb92e",
  "#e0459c": "#ef62ae",
  "#12b0c9": "#2ecbe3",
  "#7b3ff2": "#9a6bff",
  "#e33b4e": "#ff5c6e",
  // retired palette, still present on existing categories
  "#2a78d6": "#5b86ff",
  "#eb6834": "#ff8043",
  "#1baf7a": "#16c791",
  "#eda100": "#ffb92e",
  "#e87ba4": "#ef62ae",
  "#008300": "#16c791",
  "#4a3aa7": "#9a6bff",
  "#e34948": "#ff5c6e",
};

export function seriesColor(hex: string) {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return dark ? (DARK_STEP[hex] ?? hex) : hex;
}
