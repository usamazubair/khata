window.khataNavActive = "goals.html";

let goals = [];
let savedCategories = [];
let editingId = null;

const rowsEl = document.getElementById("rows");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");
const categorySelect = document.getElementById("f-category");

function renderCategoryOptions() {
  document.getElementById("no-saved-cat-hint").hidden = savedCategories.length > 0;
  categorySelect.innerHTML = savedCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function renderRows() {
  if (!goals.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">No goals yet.</td></tr>`;
    return;
  }
  rowsEl.innerHTML = goals
    .map(
      (g) => `
      <tr>
        <td>${escapeHtml(g.name)}</td>
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${seriesColor(g.category_color)};margin-right:6px;"></span>${escapeHtml(g.category_name)}</td>
        <td class="amt">${money(g.saved)} / ${money(g.price)}</td>
        <td><span class="pill ${g.remaining <= 0 ? "good" : ""}">${g.remaining <= 0 ? "Funded" : money(g.remaining)}</span></td>
        <td>${g.target_date ? new Date(g.target_date).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${g.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${g.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => remove(Number(btn.dataset.delete))));
}

function startEdit(id) {
  const g = goals.find((x) => x.id === id);
  if (!g) return;
  editingId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = g.name;
  document.getElementById("f-description").value = g.description || "";
  document.getElementById("f-price").value = g.price;
  document.getElementById("f-date").value = g.target_date ? g.target_date.slice(0, 10) : "";
  categorySelect.value = g.category_id;
  formTitle.textContent = "Edit goal";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingId = null;
  document.getElementById("item-form").reset();
  formTitle.textContent = "Add goal";
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
    target_date: document.getElementById("f-date").value || null,
    category_id: Number(categorySelect.value),
  };
  if (!body.name || !body.category_id) return;
  try {
    if (editingId) {
      await api(`/api/goals/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/api/goals", { method: "POST", body: JSON.stringify(body) });
    }
    resetForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function remove(id) {
  const g = goals.find((x) => x.id === id);
  if (!confirm(`Delete "${g.name}"?`)) return;
  try {
    await api(`/api/goals/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    await load();
  } catch (err) {
    alert(err.message);
  }
}

async function load() {
  const [allGoals, allCategories] = await Promise.all([api("/api/goals"), api("/api/categories?type=saved")]);
  goals = allGoals;
  savedCategories = allCategories;
  renderCategoryOptions();
  renderRows();
}

window.khataInit = load;
khataBoot();
