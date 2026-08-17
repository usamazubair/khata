window.khataNav = { module: "khata", active: "fixed.html" };

let bills = [];
let fixedCategories = [];
let editingId = null;
let searchQuery = "";

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");
const categorySelect = document.getElementById("f-category");

const STATUS_LABEL = { paid: "Paid", due: "Due", unlogged: "Not logged" };
const STATUS_PILL = { paid: "good", due: "warn", unlogged: "" };

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderRows();
});

function renderCategoryOptions() {
  document.getElementById("no-fixed-cat-hint").hidden = fixedCategories.length > 0;
  categorySelect.innerHTML = fixedCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function renderRows() {
  const filtered = bills.filter(
    (b) => b.name.toLowerCase().includes(searchQuery) || (b.description || "").toLowerCase().includes(searchQuery)
  );
  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="7" class="empty">${bills.length ? "No fixed transactions match your search." : "No fixed transactions yet."}</td></tr>`;
    return;
  }
  rowsEl.innerHTML = filtered
    .map(
      (b) => `
      <tr class="${b.active ? "" : "inactive-row"}">
        <td>${escapeHtml(b.name)}</td>
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${seriesColor(b.category_color)};margin-right:6px;"></span>${escapeHtml(b.category_name)}</td>
        <td>${b.due_day}</td>
        <td class="amt">${money(b.amount)}</td>
        <td><span class="pill ${STATUS_PILL[b.status]}">${STATUS_LABEL[b.status]}</span></td>
        <td><button class="active-toggle ${b.active ? "is-active" : "is-inactive"}" data-toggle="${b.id}">${b.active ? "Active" : "Inactive"}</button></td>
        <td>
          <div class="row-actions">
            ${b.status !== "paid" && b.active ? `<button class="icon-btn" data-confirm="${b.id}">Log it</button>` : ""}
            <button class="icon-btn" data-edit="${b.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${b.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => remove(Number(btn.dataset.delete))));
  rowsEl.querySelectorAll("[data-confirm]").forEach((btn) => btn.addEventListener("click", () => confirmBill(Number(btn.dataset.confirm))));
  rowsEl.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => toggleActive(Number(btn.dataset.toggle))));
}

async function toggleActive(id) {
  const b = bills.find((x) => x.id === id);
  if (!b) return;
  try {
    await api(`/api/fixed-expenses/${id}`, { method: "PUT", body: JSON.stringify({ active: !b.active }) });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

function startEdit(id) {
  const b = bills.find((x) => x.id === id);
  if (!b) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = b.name;
  document.getElementById("f-description").value = b.description || "";
  document.getElementById("f-amount").value = b.amount;
  document.getElementById("f-due").value = b.due_day;
  categorySelect.value = b.category_id;
  formTitle.textContent = "Edit fixed transaction";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  formTitle.textContent = "Add fixed transaction";
  cancelBtn.hidden = true;
  formError.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const body = {
    name: document.getElementById("f-name").value.trim(),
    description: document.getElementById("f-description").value.trim(),
    amount: Number(document.getElementById("f-amount").value),
    due_day: Number(document.getElementById("f-due").value),
    category_id: Number(categorySelect.value),
  };
  if (!body.name || !body.category_id) return;
  try {
    if (editingId) {
      await api(`/api/fixed-expenses/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/fixed-expenses", { method: "POST", body: JSON.stringify(body) });
    }
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function remove(id) {
  const b = bills.find((x) => x.id === id);
  if (!confirm(`Delete "${b.name}"?`)) return;
  try {
    await api(`/api/fixed-expenses/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function confirmBill(id) {
  try {
    await api(`/api/fixed-expenses/${id}/confirm`, { method: "POST", body: "{}" });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  const [allBills, allCategories] = await Promise.all([
    api(`/api/fixed-expenses?month=${currentMonth()}`),
    api("/api/categories?type=fixed"),
  ]);
  bills = allBills;
  fixedCategories = allCategories;
  renderCategoryOptions();
  renderRows();
}

window.khataInit = load;
khataBoot();
