window.khataNav = { admin: true, active: "users.html" };

const ROLES = ["member", "admin"];

let users = [];
let modules = [];
let editingId = null;
let selectedRole = "member";
let searchQuery = "";

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");
const passwordHint = document.getElementById("password-hint");

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderRows();
});

function renderRolePicker() {
  document.getElementById("f-role").innerHTML = ROLES.map(
    (r) => `<button type="button" data-role="${r}" class="${r === selectedRole ? "selected" : ""}">${r}</button>`
  ).join("");
  document.querySelectorAll("#f-role button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedRole = btn.dataset.role;
      renderRolePicker();
      renderModuleChecks();
    });
  });
}

function renderModuleChecks(checkedIds = null) {
  const container = document.getElementById("f-modules");
  const checked = checkedIds ?? currentCheckedModuleIds();
  if (selectedRole === "admin") {
    container.innerHTML = `<p class="form-hint" style="margin:0;">Admins can see every module automatically.</p>`;
    return;
  }
  container.innerHTML = modules
    .map(
      (m) => `
      <label class="checkbox-row">
        <input type="checkbox" value="${m.id}" ${checked.includes(m.id) ? "checked" : ""} />
        <span>${escapeHtml(m.icon)} ${escapeHtml(m.name)}</span>
      </label>`
    )
    .join("");
}

function currentCheckedModuleIds() {
  return Array.from(document.querySelectorAll("#f-modules input:checked")).map((i) => Number(i.value));
}

function renderRows() {
  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(searchQuery) || u.email.toLowerCase().includes(searchQuery)
  );
  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">${users.length ? "No users match your search." : "No users yet."}</td></tr>`;
    return;
  }
  rowsEl.innerHTML = filtered
    .map((u) => {
      const moduleNames =
        u.role === "admin"
          ? "All (admin)"
          : u.module_ids.length
            ? u.module_ids.map((id) => modules.find((m) => m.id === id)?.name || "?").join(", ")
            : "—";
      const isSelf = u.id === currentUser.id;
      return `
      <tr class="${u.active ? "" : "inactive-row"}">
        <td>${escapeHtml(u.name || "—")}${isSelf ? ' <span class="pill">you</span>' : ""}</td>
        <td class="slug">${escapeHtml(u.email)}</td>
        <td>${u.role}</td>
        <td>${escapeHtml(moduleNames)}</td>
        <td>
          <button class="active-toggle ${u.active ? "is-active" : "is-inactive"}" data-toggle="${u.id}" ${isSelf ? "disabled" : ""}>
            ${u.active ? "Active" : "Inactive"}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${u.id}">Edit</button>
            ${isSelf ? "" : `<button class="icon-btn danger" data-delete="${u.id}">Delete</button>`}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => remove(Number(btn.dataset.delete))));
  rowsEl.querySelectorAll("[data-toggle]:not([disabled])").forEach((btn) =>
    btn.addEventListener("click", () => toggleActive(Number(btn.dataset.toggle)))
  );
}

function startEdit(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = u.name || "";
  document.getElementById("f-email").value = u.email;
  document.getElementById("f-password").value = "";
  selectedRole = u.role;
  renderRolePicker();
  renderModuleChecks(u.module_ids);
  formTitle.textContent = "Edit user";
  passwordHint.hidden = false;
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  selectedRole = "member";
  renderRolePicker();
  renderModuleChecks([]);
  formTitle.textContent = "Add user";
  passwordHint.hidden = true;
  cancelBtn.hidden = true;
  formError.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const password = document.getElementById("f-password").value;
  const body = {
    name: document.getElementById("f-name").value.trim(),
    email: document.getElementById("f-email").value.trim(),
    role: selectedRole,
    module_ids: selectedRole === "admin" ? [] : currentCheckedModuleIds(),
  };
  if (password) body.password = password;
  if (!body.email) return;
  if (!editingId && !password) {
    formError.textContent = "A password is required for a new user.";
    formError.hidden = false;
    return;
  }
  try {
    if (editingId) {
      await api(`/api/users/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/users", { method: "POST", body: JSON.stringify(body) });
    }
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function toggleActive(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  try {
    await api(`/api/users/${id}`, { method: "PUT", body: JSON.stringify({ active: !u.active }) });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function remove(id) {
  const u = users.find((x) => x.id === id);
  if (!confirm(`Delete ${u.email}? They'll lose access immediately.`)) return;
  try {
    await api(`/api/users/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  const [allUsers, allModules] = await Promise.all([api("/api/users"), api("/api/modules")]);
  users = allUsers;
  modules = allModules;
  renderRows();
  renderModuleChecks(editingId ? users.find((u) => u.id === editingId)?.module_ids || [] : []);
}

window.khataInit = async () => {
  renderRolePicker();
  await load();
};
khataBoot();
