window.khataNav = { module: "workout", active: "sessions.html" };

let sessions = [];
let filters = { q: "", date_from: "", date_to: "" };
let debounceTimer = null;

const rowsEl = document.getElementById("rows");
const countEl = document.getElementById("count");
const formError = document.getElementById("form-error");

function kg(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

document.getElementById("search").addEventListener("input", (e) => {
  filters.q = e.target.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
});
document.getElementById("f-from").addEventListener("change", (e) => {
  filters.date_from = e.target.value;
  load();
});
document.getElementById("f-to").addEventListener("change", (e) => {
  filters.date_to = e.target.value;
  load();
});
document.getElementById("clear-filters").addEventListener("click", () => {
  filters = { q: "", date_from: "", date_to: "" };
  document.getElementById("search").value = "";
  document.getElementById("f-from").value = "";
  document.getElementById("f-to").value = "";
  load();
});

function renderRows() {
  countEl.textContent = `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
  if (!sessions.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">No sessions match these filters.</td></tr>`;
    return;
  }
  rowsEl.innerHTML = sessions
    .map(
      (s) => `
      <tr>
        <td class="mono">${new Date(s.occurred_on).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</td>
        <td>${escapeHtml(s.name || "Workout")}</td>
        <td>${s.set_count}</td>
        <td>${s.total_reps}</td>
        <td class="amt">${kg(s.volume)}</td>
        <td>
          <div class="row-actions">
            <a class="icon-btn" href="session.html?id=${s.id}">Open</a>
            <button class="icon-btn danger" data-delete="${s.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => remove(Number(b.dataset.delete)))
  );
}

async function remove(id) {
  const s = sessions.find((x) => x.id === id);
  if (!confirm(`Delete "${s.name || "Workout"}" and every set logged in it?`)) return;
  try {
    await api(`/api/workouts/sessions/${id}`, { method: "DELETE" });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  try {
    const created = await api("/api/workouts/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("f-name").value.trim(),
        occurred_on: document.getElementById("f-date").value || null,
        notes: document.getElementById("f-notes").value.trim(),
      }),
    });
    // Straight into the session so you can start logging sets.
    location.href = `session.html?id=${created.id}`;
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function load() {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  sessions = await api(`/api/workouts/sessions?${params.toString()}`);
  renderRows();
}

window.khataInit = load;
khataBoot();
