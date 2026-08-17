const STORAGE_KEY = "khata_dashboard_key";

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

let apiKey = localStorage.getItem(STORAGE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function looksLikeInfraHiccup(res) {
  return !(res.headers.get("content-type") || "").includes("application/json");
}

async function api(path, options = {}, attempt = 1) {
  const res = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", ...options.headers },
  });
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    apiKey = null;
    showLock(true);
    throw new Error("unauthorized");
  }
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

const lockEl = document.getElementById("lock");
const appEl = document.getElementById("app");
const lockForm = document.getElementById("lock-form");
const lockInput = document.getElementById("lock-input");
const lockError = document.getElementById("lock-error");

function showLock(withError) {
  lockEl.hidden = false;
  appEl.hidden = true;
  lockError.hidden = !withError;
  lockInput.value = "";
  lockInput.focus();
}
function showApp() {
  lockEl.hidden = true;
  appEl.hidden = false;
}

const NAV_LINKS = [
  { href: "index.html", label: "Dashboard" },
  { href: "categories.html", label: "Categories" },
  { href: "fixed.html", label: "Fixed Transactions" },
  { href: "goals.html", label: "Goals" },
  { href: "budgets.html", label: "Budgets" },
];

function renderNav(active) {
  const el = document.getElementById("navbar");
  if (!el) return;
  el.innerHTML = `
    <a class="nav-logo" href="index.html">📒 Khata</a>
    <div class="nav-links">
      ${NAV_LINKS.map((l) => `<a href="${l.href}" class="${l.href === active ? "active" : ""}">${l.label}</a>`).join("")}
    </div>
    <button id="logout-btn" class="nav-logout">Logout</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    apiKey = null;
    showLock(false);
  });
}

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = lockInput.value.trim();
  if (!candidate) return;
  apiKey = candidate;
  try {
    await window.khataInit();
    localStorage.setItem(STORAGE_KEY, apiKey);
    showApp();
  } catch (err) {
    apiKey = null;
    lockError.hidden = false;
  }
});

// Each page defines window.khataInit (loads + renders its own data) and
// window.khataNavActive (which nav link to highlight), then calls khataBoot().
async function khataBoot() {
  renderNav(window.khataNavActive);
  if (!apiKey) return showLock(false);
  try {
    await window.khataInit();
    showApp();
  } catch (err) {
    showLock(true);
  }
}
