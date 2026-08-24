window.khataNav = { module: "workout", active: "sessions.html" };

const sessionId = new URLSearchParams(location.search).get("id");

let session = null;
let exercises = [];
let editingSetId = null;

const rowsEl = document.getElementById("rows");
const formError = document.getElementById("form-error");
const cancelBtn = document.getElementById("cancel-edit");
const exerciseSelect = document.getElementById("s-exercise");

function kg(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

function renderHeader() {
  document.getElementById("session-name").textContent = session.name || "Workout";
  document.getElementById("session-date").textContent = new Date(session.occurred_on).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  document.getElementById("session-notes").value = session.notes || "";

  document.getElementById("stat-grid").innerHTML = [
    { label: "Sets", value: session.set_count },
    { label: "Reps", value: session.total_reps },
    { label: "Volume", value: kg(session.volume) },
  ]
    .map((t) => `<div class="stat-tile"><div class="label-sm">${t.label}</div><div class="value">${t.value}</div></div>`)
    .join("");
}

function renderExerciseOptions() {
  const active = exercises.filter((e) => e.active);
  document.getElementById("no-exercise-hint").hidden = active.length > 0;
  exerciseSelect.innerHTML = active
    .map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`)
    .join("");
}

function renderRows() {
  if (!session.sets.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">No sets logged yet.</td></tr>`;
    return;
  }
  rowsEl.innerHTML = session.sets
    .map(
      (s, i) => `
      <tr>
        <td class="slug">${i + 1}</td>
        <td>${escapeHtml(s.exercise_name)}</td>
        <td>${s.reps}</td>
        <td class="amt">${kg(s.weight)}</td>
        <td class="amt">${kg(s.reps * s.weight)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-repeat="${s.id}" title="Log this again">Repeat</button>
            <button class="icon-btn" data-edit="${s.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${s.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  rowsEl.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => startEdit(Number(b.dataset.edit))));
  rowsEl.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => removeSet(Number(b.dataset.delete))));
  rowsEl.querySelectorAll("[data-repeat]").forEach((b) => b.addEventListener("click", () => repeatSet(Number(b.dataset.repeat))));
}

function startEdit(id) {
  const s = session.sets.find((x) => x.id === id);
  if (!s) return;
  editingSetId = id;
  document.getElementById("s-id").value = id;
  exerciseSelect.value = s.exercise_id;
  document.getElementById("s-reps").value = s.reps;
  document.getElementById("s-weight").value = Number(s.weight);
  document.getElementById("form-title").textContent = "Edit set";
  document.getElementById("set-save").textContent = "Save changes";
  cancelBtn.hidden = false;
  formError.hidden = true;
}

function resetForm() {
  editingSetId = null;
  document.getElementById("s-id").value = "";
  document.getElementById("form-title").textContent = "Log a set";
  document.getElementById("set-save").textContent = "Add set";
  cancelBtn.hidden = true;
  formError.hidden = true;
  prefillFromLastSet();
}

// Straight sets are the common case, so carry the last set's numbers forward.
function prefillFromLastSet() {
  const last = session.sets[session.sets.length - 1];
  if (!last) return;
  exerciseSelect.value = last.exercise_id;
  document.getElementById("s-reps").value = last.reps;
  document.getElementById("s-weight").value = Number(last.weight);
}

cancelBtn.addEventListener("click", resetForm);

async function repeatSet(id) {
  const s = session.sets.find((x) => x.id === id);
  if (!s) return;
  try {
    await api(`/api/workouts/sessions/${sessionId}/sets`, {
      method: "POST",
      body: JSON.stringify({ exercise_id: s.exercise_id, reps: s.reps, weight: Number(s.weight) }),
    });
    await load();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("set-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const body = {
    exercise_id: Number(exerciseSelect.value),
    reps: Number(document.getElementById("s-reps").value),
    weight: Number(document.getElementById("s-weight").value || 0),
  };
  if (!body.exercise_id) return;
  try {
    if (editingSetId) await api(`/api/workouts/sets/${editingSetId}`, { method: "PUT", body: JSON.stringify(body) });
    else await api(`/api/workouts/sessions/${sessionId}/sets`, { method: "POST", body: JSON.stringify(body) });
    editingSetId = null;
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

async function removeSet(id) {
  if (!confirm("Delete this set?")) return;
  try {
    await api(`/api/workouts/sets/${id}`, { method: "DELETE" });
    if (editingSetId === id) editingSetId = null;
    await load();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("save-notes").addEventListener("click", async () => {
  const savedEl = document.getElementById("notes-saved");
  savedEl.hidden = true;
  try {
    await api(`/api/workouts/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify({ notes: document.getElementById("session-notes").value }),
    });
    savedEl.hidden = false;
    setTimeout(() => (savedEl.hidden = true), 2000);
  } catch (err) {
    alert(err.message);
  }
});

async function load() {
  const [detail, allExercises] = await Promise.all([
    api(`/api/workouts/sessions/${sessionId}`),
    api("/api/exercises?active=true"),
  ]);
  session = detail;
  exercises = allExercises;
  renderHeader();
  renderExerciseOptions();
  renderRows();
  resetForm();
}

window.khataInit = load;
khataBoot();
