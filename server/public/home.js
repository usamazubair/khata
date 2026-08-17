window.khataNav = { home: true };

let modules = [];
let editingId = null;

const gridEl = document.getElementById("module-grid");
const dialogEl = document.getElementById("module-dialog");
const dialogTitle = document.getElementById("dialog-title");
const dialogError = document.getElementById("dialog-error");

// System modules have hand-built pages; generic ones will render from their
// stored schema once their sections are set up.
function moduleHref(m) {
  return m.kind === "system" ? `${m.slug}.html` : `module.html?slug=${encodeURIComponent(m.slug)}`;
}

function renderGrid() {
  const isAdmin = currentUser?.role === "admin";
  const cards = modules.map((m) => {
    const inactive = m.active ? "" : " inactive-card";
    return `
      <a class="module-card${inactive}" href="${moduleHref(m)}">
        <span class="module-icon">${escapeHtml(m.icon)}</span>
        <span class="module-name">${escapeHtml(m.name)}</span>
        <span class="module-desc">${escapeHtml(m.description || "")}</span>
        ${m.active ? "" : `<span class="pill" style="margin-top:8px;">Inactive</span>`}
        ${isAdmin && m.kind !== "system" ? `<span class="module-edit" data-edit="${m.id}" role="button" tabindex="0">Edit</span>` : ""}
      </a>`;
  });

  if (isAdmin) {
    cards.push(`
      <button class="module-card add-card" id="add-module">
        <span class="module-icon">＋</span>
        <span class="module-name">Add More</span>
        <span class="module-desc">Create a new module</span>
      </button>`);
  }

  if (!modules.length && !isAdmin) {
    gridEl.innerHTML = `<p class="empty">No modules have been shared with you yet.</p>`;
    return;
  }

  gridEl.innerHTML = cards.join("");

  const addBtn = document.getElementById("add-module");
  if (addBtn) addBtn.addEventListener("click", () => openDialog());

  gridEl.querySelectorAll("[data-edit]").forEach((el) => {
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDialog(Number(el.dataset.edit));
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open(e);
    });
  });
}

function openDialog(id = null) {
  editingId = id;
  dialogError.hidden = true;
  const form = document.getElementById("module-form");
  form.reset();
  if (id) {
    const m = modules.find((x) => x.id === id);
    dialogTitle.textContent = "Edit module";
    document.getElementById("m-name").value = m.name;
    document.getElementById("m-description").value = m.description || "";
    document.getElementById("m-icon").value = m.icon || "";
  } else {
    dialogTitle.textContent = "Add module";
  }
  dialogEl.hidden = false;
  document.getElementById("m-name").focus();
}

function closeDialog() {
  dialogEl.hidden = true;
  editingId = null;
}

document.getElementById("dialog-cancel").addEventListener("click", closeDialog);
dialogEl.addEventListener("click", (e) => {
  if (e.target === dialogEl) closeDialog();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialogEl.hidden) closeDialog();
});

document.getElementById("module-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  dialogError.hidden = true;
  const body = {
    name: document.getElementById("m-name").value.trim(),
    description: document.getElementById("m-description").value.trim(),
    icon: document.getElementById("m-icon").value.trim() || "📦",
  };
  if (!body.name) return;
  try {
    if (editingId) {
      await api(`/api/modules/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/modules", { method: "POST", body: JSON.stringify(body) });
    }
    closeDialog();
    await load();
  } catch (err) {
    dialogError.textContent = err.message;
    dialogError.hidden = false;
  }
});

async function load() {
  modules = await api("/api/modules");
  renderGrid();
}

window.khataInit = load;
khataBoot();
