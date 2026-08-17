window.khataNavActive = "categories.html";

const TYPES = ["expense", "fixed", "saved", "budget"];
const SWATCHES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

let categories = [];
let editingId = null;
let selectedType = TYPES[0];
let selectedColor = SWATCHES[0];
let searchQuery = "";

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderRows();
});

function renderTypePicker() {
  document.getElementById("f-type").innerHTML = TYPES.map(
    (t) => `<button type="button" data-type="${t}" class="${t === selectedType ? "selected" : ""}">${t}</button>`
  ).join("");
  document.querySelectorAll("#f-type button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedType = btn.dataset.type;
      renderTypePicker();
    });
  });
}

function renderSwatches() {
  document.getElementById("f-color").innerHTML = SWATCHES.map(
    (hex) => `<span class="swatch ${hex === selectedColor ? "selected" : ""}" data-color="${hex}" style="background:${seriesColor(hex)}"></span>`
  ).join("");
  document.querySelectorAll("#f-color .swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      selectedColor = sw.dataset.color;
      renderSwatches();
    });
  });
}

function renderRows() {
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(searchQuery));
  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="5" class="empty">${categories.length ? "No categories match your search." : "No categories yet."}</td></tr>`;
    return;
  }
  rowsEl.innerHTML = filtered
    .map(
      (c) => `
      <tr class="${c.active ? "" : "inactive-row"}">
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${seriesColor(c.color)};margin-right:8px;"></span>${escapeHtml(c.name)}</td>
        <td class="slug">${c.slug}</td>
        <td>${c.type}</td>
        <td><button class="active-toggle ${c.active ? "is-active" : "is-inactive"}" data-toggle="${c.id}">${c.active ? "Active" : "Inactive"}</button></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${c.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${c.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => remove(Number(btn.dataset.delete))));
  rowsEl.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => toggleActive(Number(btn.dataset.toggle))));
}

async function toggleActive(id) {
  const c = categories.find((x) => x.id === id);
  if (!c) return;
  try {
    await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ active: !c.active }) });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

function startEdit(id) {
  const c = categories.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = c.name;
  selectedType = c.type;
  selectedColor = c.color;
  renderTypePicker();
  renderSwatches();
  formTitle.textContent = "Edit category";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  selectedType = TYPES[0];
  selectedColor = SWATCHES[0];
  renderTypePicker();
  renderSwatches();
  formTitle.textContent = "Add category";
  cancelBtn.hidden = true;
  formError.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const name = document.getElementById("f-name").value.trim();
  if (!name) return;
  const body = { name, type: selectedType, color: selectedColor };
  try {
    if (editingId) {
      await api(`/api/categories/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/categories", { method: "POST", body: JSON.stringify(body) });
    }
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function remove(id) {
  const c = categories.find((x) => x.id === id);
  if (!confirm(`Delete "${c.name}"? This only works if nothing references it.`)) return;
  try {
    await api(`/api/categories/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  categories = await api("/api/categories");
  renderRows();
}

window.khataInit = async () => {
  renderTypePicker();
  renderSwatches();
  await load();
};
khataBoot();
