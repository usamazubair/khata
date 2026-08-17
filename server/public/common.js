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

/* ── edit vs view mode ─────────────────────────────────────────────────────
   View mode is the normal state: use the app, add and edit records, but the
   structure stays put. Edit mode reveals everything that changes the shape of
   a module — its sections, navigation and fields. Admin-only, and remembered
   across pages so you don't have to re-enter it as you navigate.            */

const EDIT_MODE_KEY = "khata_edit_mode";
let editMode = localStorage.getItem(EDIT_MODE_KEY) === "true";

const isAdminUser = () => currentUser?.role === "admin";
// Members never get edit mode, no matter what's in their localStorage.
const canEdit = () => isAdminUser() && editMode;

function setEditMode(on) {
  editMode = on;
  localStorage.setItem(EDIT_MODE_KEY, String(on));
  document.body.classList.toggle("edit-mode", canEdit());
  renderNav();
  window.khataOnModeChange?.();
}

/* ── navigation ────────────────────────────────────────────────────────────
   Pages set window.khataNav to one of:
     { home: true }
     { module: "khata", active: "transactions.html" }   ← active = page_key
     { module: "<slug>", section: "<section-slug>" }    ← generic module
     { admin: true, active: "users.html" }

   Every module's links come from its sections, so Khata's navbar is editable
   the same way a generic module's is.                                       */

let navModule = null;
let navSections = [];

function sectionHrefFor(section) {
  return section.page_key
    ? section.page_key
    : `module.html?slug=${encodeURIComponent(navModule.slug)}&section=${encodeURIComponent(section.slug)}`;
}

function isActiveSection(section) {
  const nav = window.khataNav || {};
  if (nav.active && section.page_key) return section.page_key === nav.active;
  if (nav.section) return section.slug === nav.section;
  return false;
}

// Loads the module and its sections for whichever module page we're on.
async function loadNavContext() {
  const nav = window.khataNav || {};
  if (!nav.module) return;
  const modules = await api("/api/modules");
  navModule = modules.find((m) => m.slug === nav.module) || null;
  navSections = navModule ? await api(`/api/modules/${navModule.id}/sections`) : [];
}

function renderNav() {
  const el = document.getElementById("navbar");
  if (!el) return;
  const nav = window.khataNav || { home: true };

  let left = `<a class="nav-logo" href="index.html">📒 Khata</a>`;
  let links = "";

  if (nav.module && navModule) {
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module">${escapeHtml(navModule.icon)} ${escapeHtml(navModule.name)}</span>`;
    // Hidden sections only show while editing, so you can bring them back.
    links = navSections
      .filter((s) => s.active || canEdit())
      .map(
        (s) =>
          `<a href="${sectionHrefFor(s)}" class="${isActiveSection(s) ? "active" : ""}${s.active ? "" : " dim"}">${escapeHtml(s.icon)} ${escapeHtml(s.name)}</a>`
      )
      .join("");
    if (canEdit()) {
      links += `<button id="nav-edit-btn" class="nav-edit-link" title="Add, rename, reorder or hide sections">✎ Navigation</button>`;
    }
  } else if (nav.module) {
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module" id="nav-module-name"></span>`;
  } else if (nav.admin) {
    left = `<a class="nav-back" href="index.html">‹ Modules</a><span class="nav-module">Settings</span>`;
  }

  const adminLink =
    isAdminUser() && !nav.admin ? `<a class="nav-user-link" href="users.html">Users</a>` : "";
  const modeToggle = isAdminUser()
    ? `<button id="mode-toggle" class="mode-toggle ${editMode ? "on" : ""}" title="${
        editMode ? "Leave edit mode" : "Change sections, navigation and fields"
      }">${editMode ? "✓ Done editing" : "✎ Edit mode"}</button>`
    : "";

  el.innerHTML = `
    ${left}
    <div class="nav-links">${links}</div>
    <div class="nav-right">
      ${modeToggle}
      ${adminLink}
      <span class="nav-whoami" title="${escapeHtml(currentUser?.email || "")}">${escapeHtml(currentUser?.name || currentUser?.email || "")}</span>
      <button id="logout-btn" class="nav-logout">Logout</button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("mode-toggle")?.addEventListener("click", () => setEditMode(!editMode));
  document.getElementById("nav-edit-btn")?.addEventListener("click", openNavEditor);
}

/* ── navigation editor (shared by every module) ────────────────────────── */

let navDialogEl = null;

function buildNavEditor() {
  navDialogEl = document.createElement("div");
  navDialogEl.className = "dialog-backdrop";
  navDialogEl.hidden = true;
  navDialogEl.innerHTML = `
    <div class="dialog" style="max-width:520px;">
      <h2>Navigation — <span id="nav-editor-module"></span></h2>
      <p class="form-hint">Rename, reorder or hide the pages in this module's navbar.</p>
      <div id="nav-editor-list" class="field-list"></div>

      <h3 class="form-subhead" id="nav-editor-form-title">Add a section</h3>
      <p id="nav-editor-error" class="form-error" hidden></p>
      <form id="nav-editor-form">
        <input type="hidden" id="ne-id" />
        <div class="field-grid">
          <div class="field-row">
            <label for="ne-name">Name</label>
            <input id="ne-name" placeholder="Tasks" required />
          </div>
          <div class="field-row">
            <label for="ne-icon">Icon</label>
            <input id="ne-icon" placeholder="✅" maxlength="4" />
          </div>
        </div>
        <label class="checkbox-row" id="ne-visible-row" style="margin-bottom:14px;" hidden>
          <input type="checkbox" id="ne-active" />
          <span>Visible in the navbar and phone app</span>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="ne-save">Add section</button>
          <button type="button" class="btn btn-ghost" id="ne-cancel" hidden>Cancel edit</button>
          <button type="button" class="btn btn-ghost" id="ne-close">Done</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(navDialogEl);

  navDialogEl.querySelector("#ne-close").addEventListener("click", () => (navDialogEl.hidden = true));
  navDialogEl.addEventListener("click", (e) => {
    if (e.target === navDialogEl) navDialogEl.hidden = true;
  });
  navDialogEl.querySelector("#ne-cancel").addEventListener("click", resetNavEditorForm);
  navDialogEl.querySelector("#nav-editor-form").addEventListener("submit", saveNavSection);
}

function resetNavEditorForm() {
  const d = navDialogEl;
  d.querySelector("#nav-editor-form").reset();
  d.querySelector("#ne-id").value = "";
  d.querySelector("#ne-visible-row").hidden = true;
  d.querySelector("#nav-editor-form-title").textContent = "Add a section";
  d.querySelector("#ne-save").textContent = "Add section";
  d.querySelector("#ne-cancel").hidden = true;
  d.querySelector("#nav-editor-error").hidden = true;
}

function renderNavEditorList() {
  const el = navDialogEl.querySelector("#nav-editor-list");
  el.innerHTML = navSections
    .map(
      (s, i) => `
      <div class="field-list-row${s.active ? "" : " dim"}">
        <span class="field-list-name">${escapeHtml(s.icon)} ${escapeHtml(s.name)}</span>
        ${s.page_key ? `<span class="pill">built-in</span>` : ""}
        ${s.active ? "" : `<span class="pill">hidden</span>`}
        <button class="icon-btn" data-nemove="${s.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Move earlier">↑</button>
        <button class="icon-btn" data-nemove="${s.id}" data-dir="1" ${i === navSections.length - 1 ? "disabled" : ""} title="Move later">↓</button>
        <button class="icon-btn" data-needit="${s.id}">Edit</button>
        ${s.page_key ? "" : `<button class="icon-btn danger" data-nedel="${s.id}">Delete</button>`}
      </div>`
    )
    .join("");

  el.querySelectorAll("[data-needit]").forEach((b) =>
    b.addEventListener("click", () => {
      const s = navSections.find((x) => x.id === Number(b.dataset.needit));
      navDialogEl.querySelector("#ne-id").value = s.id;
      navDialogEl.querySelector("#ne-name").value = s.name;
      navDialogEl.querySelector("#ne-icon").value = s.icon;
      navDialogEl.querySelector("#ne-active").checked = s.active;
      navDialogEl.querySelector("#ne-visible-row").hidden = false;
      navDialogEl.querySelector("#nav-editor-form-title").textContent = `Edit “${s.name}”`;
      navDialogEl.querySelector("#ne-save").textContent = "Save changes";
      navDialogEl.querySelector("#ne-cancel").hidden = false;
      navDialogEl.querySelector("#nav-editor-error").hidden = true;
    })
  );

  el.querySelectorAll("[data-nemove]:not([disabled])").forEach((b) =>
    b.addEventListener("click", () => moveNavSection(Number(b.dataset.nemove), Number(b.dataset.dir)))
  );

  el.querySelectorAll("[data-nedel]").forEach((b) =>
    b.addEventListener("click", async () => {
      const s = navSections.find((x) => x.id === Number(b.dataset.nedel));
      if (!confirm(`Delete the "${s.name}" section?`)) return;
      try {
        await api(`/api/sections/${s.id}`, { method: "DELETE" });
        await refreshNav();
      } catch (err) {
        if (!confirm(`${err.message} Delete it anyway?`)) return;
        await api(`/api/sections/${s.id}?confirm=true`, { method: "DELETE" });
        await refreshNav();
      }
    })
  );
}

async function moveNavSection(id, delta) {
  const idx = navSections.findIndex((s) => s.id === id);
  const neighbour = navSections[idx + delta];
  if (!neighbour) return;
  try {
    await Promise.all([
      api(`/api/sections/${id}`, { method: "PUT", body: JSON.stringify({ sort_order: neighbour.sort_order }) }),
      api(`/api/sections/${neighbour.id}`, {
        method: "PUT",
        body: JSON.stringify({ sort_order: navSections[idx].sort_order }),
      }),
    ]);
    await refreshNav();
  } catch (err) {
    alert(err.message);
  }
}

async function saveNavSection(e) {
  e.preventDefault();
  const errorEl = navDialogEl.querySelector("#nav-editor-error");
  errorEl.hidden = true;
  const id = navDialogEl.querySelector("#ne-id").value;
  const payload = {
    name: navDialogEl.querySelector("#ne-name").value.trim(),
    icon: navDialogEl.querySelector("#ne-icon").value.trim() || "📄",
  };
  if (id) payload.active = navDialogEl.querySelector("#ne-active").checked;
  if (!payload.name) return;

  try {
    if (id) await api(`/api/sections/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(`/api/modules/${navModule.id}/sections`, { method: "POST", body: JSON.stringify(payload) });
    resetNavEditorForm();
    await refreshNav();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function refreshNav() {
  navSections = await api(`/api/modules/${navModule.id}/sections`);
  renderNav();
  if (navDialogEl && !navDialogEl.hidden) renderNavEditorList();
  window.khataOnSectionsChange?.(navSections);
}

function openNavEditor() {
  if (!navDialogEl) buildNavEditor();
  navDialogEl.querySelector("#nav-editor-module").textContent = navModule?.name ?? "";
  resetNavEditorForm();
  renderNavEditorList();
  navDialogEl.hidden = false;
  navDialogEl.querySelector("#ne-name").focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navDialogEl && !navDialogEl.hidden) navDialogEl.hidden = true;
});

// Only an auth failure sends you back to the login screen — if the page's own
// data fails to load, stay in the app and let the page show its empty state.
async function startApp() {
  currentUser = await api("/api/auth/me");
  document.body.classList.toggle("edit-mode", canEdit());
  await loadNavContext();
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
