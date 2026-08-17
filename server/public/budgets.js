window.khataNavActive = "budgets.html";

let budgets = [];
let budgetCategories = [];
let editingId = null;
let searchQuery = "";

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");
const categorySelect = document.getElementById("f-category");

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderRows();
});

function renderCategoryOptions() {
  document.getElementById("no-budget-cat-hint").hidden = budgetCategories.length > 0;
  categorySelect.innerHTML = budgetCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function renderRows() {
  const filtered = budgets.filter((b) => b.name.toLowerCase().includes(searchQuery));
  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">${budgets.length ? "No budgets match your search." : "No budgets yet."}</td></tr>`;
    return;
  }
  rowsEl.innerHTML = filtered
    .map((b) => {
      const pct = b.price > 0 ? (b.spent / b.price) * 100 : 0;
      const pillClass = b.remaining < 0 ? "bad" : pct >= 85 ? "warn" : "good";
      return `
      <tr class="${b.active ? "" : "inactive-row"}">
        <td>${escapeHtml(b.name)}</td>
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${seriesColor(b.category_color)};margin-right:6px;"></span>${escapeHtml(b.category_name)}</td>
        <td class="amt">${money(b.spent)} / ${money(b.price)}</td>
        <td><span class="pill ${pillClass}">${b.remaining < 0 ? money(-b.remaining) + " over" : money(b.remaining)}</span></td>
        <td><button class="active-toggle ${b.active ? "is-active" : "is-inactive"}" data-toggle="${b.id}">${b.active ? "Active" : "Inactive"}</button></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${b.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${b.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => remove(Number(btn.dataset.delete))));
  rowsEl.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => toggleActive(Number(btn.dataset.toggle))));
}

async function toggleActive(id) {
  const b = budgets.find((x) => x.id === id);
  if (!b) return;
  try {
    await api(`/api/budgets/${id}`, { method: "PUT", body: JSON.stringify({ active: !b.active }) });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

function startEdit(id) {
  const b = budgets.find((x) => x.id === id);
  if (!b) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = b.name;
  document.getElementById("f-description").value = b.description || "";
  document.getElementById("f-price").value = b.price;
  categorySelect.value = b.category_id;
  formTitle.textContent = "Edit budget";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  formTitle.textContent = "Add budget";
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
    price: Number(document.getElementById("f-price").value),
    category_id: Number(categorySelect.value),
  };
  if (!body.name || !body.category_id) return;
  try {
    if (editingId) {
      await api(`/api/budgets/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/budgets", { method: "POST", body: JSON.stringify(body) });
    }
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function remove(id) {
  const b = budgets.find((x) => x.id === id);
  if (!confirm(`Delete "${b.name}"?`)) return;
  try {
    await api(`/api/budgets/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  const [allBudgets, allCategories] = await Promise.all([
    api(`/api/budgets?month=${currentMonth()}`),
    api("/api/categories?type=budget"),
  ]);
  budgets = allBudgets;
  budgetCategories = allCategories;
  renderCategoryOptions();
  renderRows();
}

window.khataInit = load;
khataBoot();
