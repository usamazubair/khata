const TOKEN_KEY = "khata_token";

// Light-mode categorical hex (as stored in the DB) -> dark-mode step.
const DARK_STEP = {
  "#2a78d6": "#3987e5", "#eb6834": "#d95926", "#1baf7a": "#199e70", "#eda100": "#c98500",
  "#e87ba4": "#d55181", "#008300": "#008300", "#4a3aa7": "#9085e9", "#e34948": "#e66767",
};

function isDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function seriesColor(hex) {
  return isDark() ? DARK_STEP[hex] || hex : hex;
}
function money(n) {
  const num = Number(n);
  return "Rs " + num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 2 : 0 });
}
function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let token = localStorage.getItem(TOKEN_KEY);
let currentUser = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function looksLikeInfraHiccup(res) {
  return !(res.headers.get("content-type") || "").includes("application/json");
}

async function api(path, options = {}, attempt = 1) {
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
    localStorage.removeItem(TOKEN_KEY);
    token = null;
    currentUser = null;
    showLogin("Your session expired. Sign in again.");
    throw new Error("unauthorized");
  }
  // A sleeping free-tier host can 404 with a plain-text body for a beat while
  // it wakes up. Our routes always answer JSON, so retry that briefly.
  if (!res.ok && looksLikeInfraHiccup(res) && attempt < 3) {
    await sleep(attempt * 1500);
    return api(path, options, attempt + 1);
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

/* ── login overlay ─────────────────────────────────────────────────────────
   Injected here rather than repeated in every page's HTML. */
let loginEl = null;
let appEl = null;

function buildLogin() {
  loginEl = document.createElement("div");
  loginEl.className = "lock";
  loginEl.hidden = true;
  loginEl.innerHTML = `
    <div class="lock-card">
      <p class="eyebrow">Khata</p>
      <h1>Sign in</h1>
      <p class="lock-sub">Your personal cupboard — expenses and whatever else you keep here.</p>
      <form id="login-form">
        <input id="login-email" type="email" placeholder="Email" autocomplete="username" required />
        <input id="login-password" type="password" placeholder="Password" autocomplete="current-password" required />
        <button type="submit" id="login-submit">Sign in</button>
      </form>
      <p id="login-error" class="lock-error" hidden></p>
    </div>
  `;
  document.body.prepend(loginEl);

  loginEl.querySelector("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = loginEl.querySelector("#login-error");
    const submitBtn = loginEl.querySelector("#login-submit");
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";
    try {
      const body = JSON.stringify({
        email: loginEl.querySelector("#login-email").value.trim(),
        password: loginEl.querySelector("#login-password").value,
      });
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed.");
      token = data.token;
      currentUser = data.user;
      localStorage.setItem(TOKEN_KEY, token);
      loginEl.querySelector("#login-password").value = "";
      await startApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  });
}

function showLogin(message) {
  if (!loginEl) buildLogin();
  loginEl.hidden = false;
  if (appEl) appEl.hidden = true;
  const errorEl = loginEl.querySelector("#login-error");
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    errorEl.hidden = true;
  }
  loginEl.querySelector("#login-email").focus();
}

function showApp() {
  if (loginEl) loginEl.hidden = true;
  appEl.hidden = false;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  token = null;
  currentUser = null;
  showLogin();
}

/* ── navigation ────────────────────────────────────────────────────────────
   Pages set window.khataNav to one of:
     { home: true }
     { module: "khata", active: "transactions.html" }
     { admin: true, active: "users.html" }                                  */

const KHATA_NAV = [
  { href: "khata.html", label: "Overview" },
  { href: "transactions.html", label: "Transactions" },
  { href: "categories.html", label: "Categories" },
  { href: "fixed.html", label: "Fixed Transactions" },
  { href: "goals.html", label: "Goals" },
  { href: "budgets.html", label: "Budgets" },
];

function renderNav() {
  const el = document.getElementById("navbar");
  if (!el) return;
  const nav = window.khataNav || { home: true };

  let left = `<a class="nav-logo" href="index.html">📒 Khata</a>`;
  let links = "";

  if (nav.module === "khata") {
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module">📒 Khata</span>`;
    links = KHATA_NAV.map(
      (l) => `<a href="${l.href}" class="${l.href === nav.active ? "active" : ""}">${l.label}</a>`
    ).join("");
  } else if (nav.module) {
    // Generic module — its own sections become links once they exist.
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module" id="nav-module-name"></span>`;
  } else if (nav.admin) {
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module">Settings</span>`;
  }

  const adminLink =
    currentUser?.role === "admin" && !nav.admin
      ? `<a class="nav-user-link" href="users.html">Users</a>`
      : "";

  el.innerHTML = `
    ${left}
    <div class="nav-links">${links}</div>
    <div class="nav-right">
      ${adminLink}
      <span class="nav-whoami" title="${escapeHtml(currentUser?.email || "")}">${escapeHtml(currentUser?.name || currentUser?.email || "")}</span>
      <button id="logout-btn" class="nav-logout">Logout</button>
    </div>
  `;
  document.getElementById("logout-btn").addEventListener("click", logout);
}

// Only an auth failure sends you back to the login screen — if the page's own
// data fails to load, stay in the app and let the page show its empty state.
async function startApp() {
  currentUser = await api("/api/auth/me");
  renderNav();
  try {
    await window.khataInit();
  } catch (err) {
    if (err.message !== "unauthorized") console.error("Couldn't load this page:", err);
  }
  showApp();
}

// Each page defines window.khataInit (loads + renders its own data) and
// window.khataNav (which nav to show), then calls khataBoot().
async function khataBoot() {
  appEl = document.getElementById("app");
  buildLogin();
  if (!token) return showLogin();
  try {
    await startApp();
  } catch (err) {
    if (err.message !== "unauthorized") showLogin(err.message);
  }
}
