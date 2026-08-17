const slug = new URLSearchParams(location.search).get("slug");
const wantedSection = new URLSearchParams(location.search).get("section");

// common.js builds the navbar and owns the section editor; this page owns the
// records table, its form, and the field manager for the current section.
window.khataNav = { module: slug, section: wantedSection };

const FIELD_TYPE_LABELS = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  money: "Money",
  date: "Date",
  boolean: "Yes / no",
  select: "Dropdown",
  color: "Colour",
  relation: "Link to a record",
};

let activeSection = null;
let records = [];
let editingId = null;
let editingFieldId = null;
let searchQuery = "";
let searchTimer = null;
// Target-section records for relation dropdowns, fetched once per section.
const relationOptions = new Map();

/* ── helpers ───────────────────────────────────────────────────────────── */

function formatCell(field, record) {
  const value = record.data?.[field.key];
  if (value === undefined || value === null || value === "") return "—";
  switch (field.type) {
    case "money":
      return money(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    case "color":
      return `<span class="dot" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${escapeHtml(value)};margin-right:6px;vertical-align:-1px;"></span><span class="slug">${escapeHtml(value)}</span>`;
    case "relation":
      return escapeHtml(record.relations?.[field.key]?.label ?? `#${value}`);
    case "longtext":
      return escapeHtml(String(value).length > 60 ? String(value).slice(0, 60) + "…" : String(value));
    default:
      return escapeHtml(String(value));
  }
}

async function relationChoices(field) {
  const targetId = field.options?.section_id;
  if (!targetId) return [];
  if (!relationOptions.has(targetId)) {
    try {
      relationOptions.set(targetId, await api(`/api/sections/${targetId}/records?active=true`));
    } catch {
      relationOptions.set(targetId, []);
    }
  }
  return relationOptions.get(targetId);
}

/* ── record table ──────────────────────────────────────────────────────── */

function renderTable() {
  const fields = activeSection.fields;
  const head = document.getElementById("table-head");
  const body = document.getElementById("rows");

  head.innerHTML = fields.map((f) => `<th>${escapeHtml(f.name)}</th>`).join("") + "<th>Status</th><th></th>";

  if (!records.length) {
    body.innerHTML = `<tr><td colspan="${fields.length + 2}" class="empty">${
      searchQuery ? "No records match your search." : "No records yet."
    }</td></tr>`;
    return;
  }

  body.innerHTML = records
    .map(
      (r) => `
      <tr class="${r.active ? "" : "inactive-row"}">
        ${fields.map((f) => `<td>${formatCell(f, r)}</td>`).join("")}
        <td><button class="active-toggle ${r.active ? "is-active" : "is-inactive"}" data-toggle="${r.id}">${r.active ? "Active" : "Inactive"}</button></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${r.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${r.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => startEdit(Number(b.dataset.edit))));
  body.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => removeRecord(Number(b.dataset.delete))));
  body.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => toggleRecord(Number(b.dataset.toggle))));
}

/* ── record form, built from the field schema ──────────────────────────── */

async function renderForm(values = {}) {
  const fields = activeSection.fields;
  document.getElementById("no-fields-hint").hidden = fields.length > 0;
  document.getElementById("record-save").hidden = fields.length === 0;

  const parts = [];
  for (const field of fields) {
    const id = `rf-${field.key}`;
    const value = values[field.key];
    const label = `<label for="${id}">${escapeHtml(field.name)}${field.required ? " *" : ""}</label>`;
    let control = "";

    switch (field.type) {
      case "longtext":
        control = `<textarea id="${id}">${escapeHtml(value ?? "")}</textarea>`;
        break;
      case "number":
        control = `<input id="${id}" type="number" step="any" value="${value ?? ""}" />`;
        break;
      case "money":
        control = `<input id="${id}" type="number" step="0.01" min="0" value="${value ?? ""}" />`;
        break;
      case "date":
        control = `<input id="${id}" type="date" value="${value ? String(value).slice(0, 10) : ""}" />`;
        break;
      case "boolean":
        control = `<label class="checkbox-row"><input id="${id}" type="checkbox" ${value ? "checked" : ""} /><span>Yes</span></label>`;
        break;
      case "select":
        control = `<select id="${id}"><option value="">—</option>${(field.options?.choices || [])
          .map((c) => `<option value="${escapeHtml(c)}" ${c === value ? "selected" : ""}>${escapeHtml(c)}</option>`)
          .join("")}</select>`;
        break;
      case "color":
        control = `<input id="${id}" type="color" value="${value || "#2a78d6"}" style="height:40px;padding:4px;" />`;
        break;
      case "relation": {
        const choices = await relationChoices(field);
        control = `<select id="${id}"><option value="">—</option>${choices
          .map((c) => `<option value="${c.id}" ${String(c.id) === String(value) ? "selected" : ""}>${escapeHtml(c.title)}</option>`)
          .join("")}</select>`;
        break;
      }
      default:
        control = `<input id="${id}" type="text" value="${escapeHtml(value ?? "")}" />`;
    }

    parts.push(`<div class="field-row">${label}${control}</div>`);
  }

  document.getElementById("form-fields").innerHTML = parts.join("");
}

function readForm() {
  const out = {};
  for (const field of activeSection.fields) {
    const el = document.getElementById(`rf-${field.key}`);
    if (!el) continue;
    if (field.type === "boolean") out[field.key] = el.checked;
    else if (el.value === "") out[field.key] = null;
    else out[field.key] = el.value;
  }
  return out;
}

async function startEdit(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  await renderForm(r.data || {});
  document.getElementById("form-title").textContent = "Edit record";
  document.getElementById("cancel-edit").hidden = false;
  document.getElementById("form-error").hidden = true;
}

async function resetForm() {
  editingId = null;
  await renderForm({});
  document.getElementById("form-title").textContent = "Add record";
  document.getElementById("cancel-edit").hidden = true;
  document.getElementById("form-error").hidden = true;
}

document.getElementById("cancel-edit").addEventListener("click", resetForm);

document.getElementById("record-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("form-error");
  errorEl.hidden = true;
  try {
    const body = JSON.stringify({ data: readForm() });
    if (editingId) await api(`/api/records/${editingId}`, { method: "PUT", body });
    else await api(`/api/sections/${activeSection.id}/records`, { method: "POST", body });
    await resetForm();
    await loadRecords();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

async function toggleRecord(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  try {
    await api(`/api/records/${id}`, { method: "PUT", body: JSON.stringify({ active: !r.active }) });
    await loadRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function removeRecord(id) {
  const r = records.find((x) => x.id === id);
  if (!confirm(`Delete "${r?.title ?? "this record"}"?`)) return;
  try {
    await api(`/api/records/${id}`, { method: "DELETE" });
    if (editingId === id) await resetForm();
    await loadRecords();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadRecords, 300);
});

/* ── fields dialog (edit mode only) ────────────────────────────────────── */

function openDialog(id) {
  document.getElementById(id).hidden = false;
}
function closeDialog(id) {
  document.getElementById(id).hidden = true;
}
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => closeDialog(b.dataset.close))
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDialog("fields-dialog");
});

function renderFieldList() {
  const el = document.getElementById("field-list");
  const fields = activeSection.fields;
  if (!fields.length) {
    el.innerHTML = `<p class="empty" style="padding:0 0 10px;">No fields yet — add the first one below.</p>`;
    return;
  }
  el.innerHTML = fields
    .map(
      (f, i) => `
      <div class="field-list-row">
        <span class="field-list-name">${escapeHtml(f.name)}${f.required ? " *" : ""}</span>
        <span class="slug">${escapeHtml(f.key)}</span>
        <span class="pill">${FIELD_TYPE_LABELS[f.type] || f.type}</span>
        <button class="icon-btn" data-movefield="${f.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
        <button class="icon-btn" data-movefield="${f.id}" data-dir="1" ${i === fields.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        <button class="icon-btn" data-editfield="${f.id}">Edit</button>
        <button class="icon-btn danger" data-delfield="${f.id}">Remove</button>
      </div>`
    )
    .join("");

  el.querySelectorAll("[data-editfield]").forEach((b) =>
    b.addEventListener("click", () => startFieldEdit(Number(b.dataset.editfield)))
  );
  el.querySelectorAll("[data-movefield]:not([disabled])").forEach((b) =>
    b.addEventListener("click", () => moveField(Number(b.dataset.movefield), Number(b.dataset.dir)))
  );
  el.querySelectorAll("[data-delfield]").forEach((b) =>
    b.addEventListener("click", async () => {
      const field = fields.find((f) => f.id === Number(b.dataset.delfield));
      if (!confirm(`Remove the "${field.name}" field? Values already stored under it stop showing.`)) return;
      try {
        await api(`/api/fields/${field.id}`, { method: "DELETE" });
        if (editingFieldId === field.id) resetFieldForm();
        await refreshAfterSchemaChange();
      } catch (err) {
        alert(err.message);
      }
    })
  );
}

async function moveField(id, delta) {
  const fields = activeSection.fields;
  const idx = fields.findIndex((f) => f.id === id);
  const neighbour = fields[idx + delta];
  if (!neighbour) return;
  try {
    await Promise.all([
      api(`/api/fields/${id}`, { method: "PUT", body: JSON.stringify({ sort_order: neighbour.sort_order }) }),
      api(`/api/fields/${neighbour.id}`, { method: "PUT", body: JSON.stringify({ sort_order: fields[idx].sort_order }) }),
    ]);
    await refreshAfterSchemaChange();
  } catch (err) {
    alert(err.message);
  }
}

// A schema change moves the table columns and the form inputs together.
async function refreshAfterSchemaChange() {
  const fresh = await api(`/api/modules/${navModule.id}/sections`);
  navSections = fresh;
  activeSection = fresh.find((s) => s.id === activeSection.id) || activeSection;
  renderFieldList();
  renderTable();
  await resetForm();
}

function startFieldEdit(id) {
  const field = activeSection.fields.find((f) => f.id === id);
  if (!field) return;
  editingFieldId = id;
  document.getElementById("f-id").value = id;
  document.getElementById("f-name").value = field.name;
  document.getElementById("f-required").checked = field.required;

  const typeSelect = document.getElementById("f-type");
  typeSelect.value = field.type;
  typeSelect.disabled = true;
  document.getElementById("f-type-locked").hidden = false;

  renderTypeExtras();
  if (field.type === "select") {
    document.getElementById("f-choices").value = (field.options?.choices || []).join("\n");
  }
  if (field.type === "relation") {
    document.getElementById("f-relation").value = field.options?.section_id ?? "";
  }

  document.getElementById("field-form-title").textContent = `Edit “${field.name}”`;
  document.getElementById("field-save").textContent = "Save changes";
  document.getElementById("field-cancel-edit").hidden = false;
  document.getElementById("fields-dialog-error").hidden = true;
}

function resetFieldForm() {
  editingFieldId = null;
  document.getElementById("field-form").reset();
  document.getElementById("f-id").value = "";
  document.getElementById("f-type").disabled = false;
  document.getElementById("f-type-locked").hidden = true;
  document.getElementById("field-form-title").textContent = "Add a field";
  document.getElementById("field-save").textContent = "Add field";
  document.getElementById("field-cancel-edit").hidden = true;
  document.getElementById("fields-dialog-error").hidden = true;
  renderTypeExtras();
}

document.getElementById("field-cancel-edit").addEventListener("click", resetFieldForm);

document.getElementById("manage-fields").addEventListener("click", () => {
  document.getElementById("fields-dialog-section").textContent = activeSection.name;
  resetFieldForm();
  renderFieldList();
  openDialog("fields-dialog");
});

function renderTypeExtras() {
  const type = document.getElementById("f-type").value;
  document.getElementById("choices-row").hidden = type !== "select";
  const relationRow = document.getElementById("relation-row");
  relationRow.hidden = type !== "relation";
  if (type === "relation") {
    // Only generic sections hold records worth linking to.
    document.getElementById("f-relation").innerHTML = navSections
      .filter((s) => !s.page_key)
      .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join("");
  }
}

document.getElementById("f-type").addEventListener("change", renderTypeExtras);

document.getElementById("field-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("fields-dialog-error");
  errorEl.hidden = true;
  const type = document.getElementById("f-type").value;
  const body = {
    name: document.getElementById("f-name").value.trim(),
    type,
    required: document.getElementById("f-required").checked,
    options: {},
  };
  if (type === "select") {
    body.options.choices = document.getElementById("f-choices").value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (type === "relation") body.options.section_id = Number(document.getElementById("f-relation").value);

  try {
    if (editingFieldId) {
      // The key and type are fixed; only label, required and options change.
      const { name, required, options } = body;
      await api(`/api/fields/${editingFieldId}`, { method: "PUT", body: JSON.stringify({ name, required, options }) });
    } else {
      await api(`/api/sections/${activeSection.id}/fields`, { method: "POST", body: JSON.stringify(body) });
    }
    resetFieldForm();
    await refreshAfterSchemaChange();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

/* ── loading ───────────────────────────────────────────────────────────── */

async function loadRecords() {
  const params = new URLSearchParams();
  if (searchQuery) params.set("q", searchQuery);
  if (!canEdit()) params.set("active", "true");
  records = await api(`/api/sections/${activeSection.id}/records?${params.toString()}`);
  renderTable();
}

function applyMode() {
  document.getElementById("section-admin").hidden = !(canEdit() && activeSection && !activeSection.page_key);
}

// common.js calls these when the mode flips or sections change under us.
window.khataOnModeChange = () => {
  applyMode();
  if (activeSection) loadRecords();
};
window.khataOnSectionsChange = (sections) => {
  if (activeSection) activeSection = sections.find((s) => s.id === activeSection.id) || activeSection;
};

async function load() {
  if (!navModule) {
    document.getElementById("module-title").textContent = "Module not found";
    document.getElementById("module-kicker").textContent = "";
    document.getElementById("empty-state").hidden = false;
    document.getElementById("empty-title").textContent = "No such module";
    document.getElementById("empty-body").textContent = "It may have been deleted, or you don't have access to it.";
    return;
  }

  document.title = `Khata — ${navModule.name}`;
  document.getElementById("module-title").textContent = navModule.name;
  document.getElementById("module-kicker").textContent = navModule.description || "Module";
  document.getElementById("empty-icon").textContent = navModule.icon;

  const selectable = navSections.filter((s) => s.active || canEdit());
  activeSection = selectable.find((s) => s.slug === wantedSection) || selectable.find((s) => !s.page_key) || null;

  // A built-in section has its own page — send the browser there instead.
  if (activeSection?.page_key) {
    location.replace(activeSection.page_key);
    return;
  }

  applyMode();

  if (!activeSection) {
    document.getElementById("empty-state").hidden = false;
    document.getElementById("section-body").hidden = true;
    return;
  }

  document.getElementById("empty-state").hidden = true;
  document.getElementById("section-body").hidden = false;
  document.getElementById("module-title").textContent = activeSection.name;
  document.getElementById("module-kicker").textContent = navModule.name;

  document.getElementById("f-type").innerHTML = Object.entries(FIELD_TYPE_LABELS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");

  await resetForm();
  await loadRecords();
}

window.khataInit = load;
khataBoot();
