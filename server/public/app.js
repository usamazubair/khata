const STORAGE_KEY = "khata_dashboard_key";

// Light-mode categorical hex (as stored in the DB) -> dark-mode step, per the
// validated palette used across Khata. Custom category colors just fall back
// to their stored hex in both themes.
const DARK_STEP = {
  "#2a78d6": "#3987e5",
  "#eb6834": "#d95926",
  "#1baf7a": "#199e70",
  "#eda100": "#c98500",
  "#e87ba4": "#d55181",
  "#008300": "#008300",
  "#4a3aa7": "#9085e9",
  "#e34948": "#e66767",
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

const lockEl = document.getElementById("lock");
const appEl = document.getElementById("app");
const lockForm = document.getElementById("lock-form");
const lockInput = document.getElementById("lock-input");
const lockError = document.getElementById("lock-error");

let apiKey = localStorage.getItem(STORAGE_KEY);
let currentMonth = new Date().toISOString().slice(0, 7);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A sleeping free-tier host can 404 with a plain-text body for a beat while
// it wakes up, before routing settles. Our own routes always answer with
// JSON, so treat a non-JSON error as that transient state and retry briefly
// rather than showing it as a real failure.
function looksLikeInfraHiccup(res) {
  return !(res.headers.get("content-type") || "").includes("application/json");
}

async function api(path, attempt = 1) {
  // no-store: these are live data endpoints, not static assets — a cached
  // 304 has no body and makes res.ok false, which looked like a real
  // failure and left the page stuck on the lock screen after a correct
  // password.
  const res = await fetch(path, { headers: { "x-api-key": apiKey }, cache: "no-store" });
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    apiKey = null;
    showLock(true);
    throw new Error("unauthorized");
  }
  if (!res.ok && looksLikeInfraHiccup(res) && attempt < 3) {
    await sleep(attempt * 1500);
    return api(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

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

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = lockInput.value.trim();
  if (!candidate) return;
  apiKey = candidate;
  try {
    await load();
    localStorage.setItem(STORAGE_KEY, apiKey);
    showApp();
  } catch (err) {
    apiKey = null;
    lockError.hidden = false;
  }
});

document.getElementById("prev-month").addEventListener("click", () => {
  currentMonth = shiftMonth(currentMonth, -1);
  load();
});
document.getElementById("next-month").addEventListener("click", () => {
  currentMonth = shiftMonth(currentMonth, 1);
  load();
});

function renderHero(data) {
  document.getElementById("month-label").textContent = monthLabel(currentMonth);
  document.getElementById("total-spent").textContent = money(data.total_spent);

  const budgetFill = document.getElementById("budget-fill");
  const caption = document.getElementById("budget-caption");
  if (data.budget_total > 0) {
    const pct = Math.min(100, Math.round((data.total_spent / data.budget_total) * 100));
    budgetFill.style.width = pct + "%";
    budgetFill.style.background = pct >= 100 ? "var(--critical)" : pct >= 85 ? "var(--warning)" : "var(--accent-2-fill)";
    const left = data.budget_total - data.total_spent;
    caption.textContent = left >= 0
      ? `${money(left)} left of ${money(data.budget_total)}`
      : `${money(-left)} over the ${money(data.budget_total)} budget`;
  } else {
    budgetFill.style.width = "0%";
    caption.textContent = "No budget set for this month.";
  }
}

function renderCategoryBars(byCategory) {
  const el = document.getElementById("category-bars");
  el.innerHTML = "";
  if (!byCategory.length) {
    el.innerHTML = '<p class="empty">No spending yet this month.</p>';
    return;
  }
  const max = Math.max(...byCategory.map((c) => c.total));
  for (const c of byCategory) {
    const color = seriesColor(c.color);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="dot" style="background:${color}"></span>
      <span class="name">${c.name}</span>
      <span class="track"><span class="fill" style="width:${(c.total / max) * 100}%;background:${color}"></span></span>
      <span class="amt">${money(c.total)}</span>
    `;
    el.appendChild(row);
  }
}

function renderRecent(recent) {
  const el = document.getElementById("recent-list");
  el.innerHTML = "";
  if (!recent.length) {
    el.innerHTML = '<p class="empty">No transactions yet.</p>';
    return;
  }
  for (const t of recent) {
    const color = seriesColor(t.category_color);
    const date = new Date(t.occurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <span class="dot" style="background:${color}"></span>
      <span class="txt"><div class="main">${t.description || t.category_name}</div><div class="sub">${date} · ${t.category_name}${t.is_paid ? "" : " · Unpaid"}</div></span>
      <span class="amt">${money(t.amount)}</span>
    `;
    el.appendChild(row);
  }
}

function renderArchives(archives) {
  const el = document.getElementById("archive-list");
  el.innerHTML = "";
  if (!archives.length) {
    el.innerHTML = '<p class="empty">No earlier months yet.</p>';
    return;
  }
  for (const a of archives) {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <span class="txt"><div class="main">${monthLabel(a.month)}</div><div class="sub">${a.count} entries</div></span>
      <span class="amt">${money(a.total)}</span>
    `;
    el.appendChild(row);
  }
}

async function load() {
  const data = await api(`/api/summary?month=${currentMonth}`);
  renderHero(data);
  renderCategoryBars(data.by_category);
  renderRecent(data.recent);
  renderArchives(data.archives);
  return data;
}

(async function init() {
  if (!apiKey) return showLock(false);
  try {
    await load();
    showApp();
  } catch (err) {
    showLock(true);
  }
})();
