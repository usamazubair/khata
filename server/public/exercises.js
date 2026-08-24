window.khataNav = { module: "workout", active: "exercises.html" };

let exercises = [];
let editingId = null;
let searchQuery = "";

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderRows();
});

function renderRows() {
  const filtered = exercises.filter(
    (x) =>
      x.name.toLowerCase().includes(searchQuery) ||
      (x.muscle_group || "").toLowerCase().includes(searchQuery) ||
      (x.equipment || "").toLowerCase().includes(searchQuery)
  );
  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="5" class="empty">${
      exercises.length ? "No exercises match your search." : "No exercises yet."
    }</td></tr>`;
    return;
  }
  rowsEl.innerHTML = filtered
    .map(
      (x) => `
      <tr class="${x.active ? "" : "inactive-row"}">
        <td>${escapeHtml(x.name)}</td>
        <td>${escapeHtml(x.muscle_group || "—")}</td>
        <td>${escapeHtml(x.equipment || "—")}</td>
        <td><button class="active-toggle ${x.active ? "is-active" : "is-inactive"}" data-toggle="${x.id}">${x.active ? "Active" : "Inactive"}</button></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${x.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${x.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => startEdit(Number(b.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => remove(Number(b.dataset.delete))));
  rowsEl.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => toggleActive(Number(b.dataset.toggle))));
}

function startEdit(id) {
  const x = exercises.find((e) => e.id === id);
  if (!x) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = x.name;
  document.getElementById("f-muscle").value = x.muscle_group || "";
  document.getElementById("f-equipment").value = x.equipment || "";
  document.getElementById("f-notes").value = x.notes || "";
  formTitle.textContent = "Edit exercise";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  formTitle.textContent = "Add exercise";
  cancelBtn.hidden = true;
  formError.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const body = {
    name: document.getElementById("f-name").value.trim(),
    muscle_group: document.getElementById("f-muscle").value.trim(),
    equipment: document.getElementById("f-equipment").value.trim(),
    notes: document.getElementById("f-notes").value.trim(),
  };
  if (!body.name) return;
  try {
    if (editingId) await api(`/api/exercises/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    else await api("/api/exercises", { method: "POST", body: JSON.stringify(body) });
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function toggleActive(id) {
  const x = exercises.find((e) => e.id === id);
  if (!x) return;
  try {
    await api(`/api/exercises/${id}`, { method: "PUT", body: JSON.stringify({ active: !x.active }) });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function remove(id) {
  const x = exercises.find((e) => e.id === id);
  if (!confirm(`Delete "${x.name}"? This only works if no sets reference it.`)) return;
  try {
    await api(`/api/exercises/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  exercises = await api("/api/exercises");
  renderRows();
}

window.khataInit = load;
khataBoot();
