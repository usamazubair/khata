const { pool } = require("./db");

const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "money",
  "date",
  "boolean",
  "select",
  "color",
  "relation",
];

// Types whose stored value is a string we can match against a search term.
const TEXTUAL_TYPES = new Set(["text", "longtext", "select", "date", "color"]);

const isBlank = (v) => v === undefined || v === null || v === "";

/** Validates one value against a field definition, returning the value to
 *  store (coerced) or an error message. Relation targets are checked by the
 *  caller, which can batch the existence lookups. */
function coerceValue(field, raw) {
  if (isBlank(raw)) {
    if (field.required) return { error: `${field.name} is required.` };
    return { value: null };
  }

  switch (field.type) {
    case "text":
    case "longtext":
      return { value: String(raw) };

    case "number":
    case "money": {
      const num = Number(raw);
      if (!Number.isFinite(num)) return { error: `${field.name} must be a number.` };
      return { value: num };
    }

    case "date": {
      const str = String(raw).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return { error: `${field.name} must be a date (YYYY-MM-DD).` };
      if (Number.isNaN(Date.parse(str))) return { error: `${field.name} isn't a real date.` };
      return { value: str };
    }

    case "boolean":
      if (typeof raw === "boolean") return { value: raw };
      if (raw === "true" || raw === "false") return { value: raw === "true" };
      return { error: `${field.name} must be yes or no.` };

    case "select": {
      const choices = field.options?.choices || [];
      const str = String(raw);
      if (!choices.includes(str)) {
        return { error: `${field.name} must be one of: ${choices.join(", ") || "(no choices defined)"}.` };
      }
      return { value: str };
    }

    case "color": {
      const str = String(raw);
      if (!/^#[0-9a-fA-F]{6}$/.test(str)) return { error: `${field.name} must be a colour like #2a78d6.` };
      return { value: str.toLowerCase() };
    }

    case "relation": {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) return { error: `${field.name} must reference a record.` };
      return { value: id };
    }

    default:
      return { error: `${field.name} has an unknown type.` };
  }
}

/** Validates a whole record payload against a section's fields. Unknown keys
 *  are dropped rather than stored, so a stale client can't smuggle data in. */
async function validateRecordData(fields, payload) {
  const data = {};
  const errors = [];
  const relationChecks = [];

  for (const field of fields) {
    const { value, error } = coerceValue(field, payload?.[field.key]);
    if (error) {
      errors.push(error);
      continue;
    }
    if (value !== null) {
      data[field.key] = value;
      if (field.type === "relation") {
        relationChecks.push({ field, id: value });
      }
    }
  }

  // One query per referenced section confirms the targets actually exist.
  const bySection = new Map();
  for (const check of relationChecks) {
    const sectionId = check.field.options?.section_id;
    if (!sectionId) {
      errors.push(`${check.field.name} isn't pointed at a section yet.`);
      continue;
    }
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId).push(check);
  }

  for (const [sectionId, checks] of bySection) {
    const ids = [...new Set(checks.map((c) => c.id))];
    const { rows } = await pool.query("SELECT id FROM records WHERE section_id = $1 AND id = ANY($2::int[])", [
      sectionId,
      ids,
    ]);
    const found = new Set(rows.map((r) => r.id));
    for (const check of checks) {
      if (!found.has(check.id)) errors.push(`${check.field.name} points at a record that doesn't exist.`);
    }
  }

  return { data, errors };
}

/** A record's human label: the first text-ish field with a value, else #id. */
function recordTitle(fields, record) {
  const ordered = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const titleField =
    ordered.find((f) => f.type === "text" && !isBlank(record.data?.[f.key])) ||
    ordered.find((f) => TEXTUAL_TYPES.has(f.type) && !isBlank(record.data?.[f.key]));
  return titleField ? String(record.data[titleField.key]) : `#${record.id}`;
}

/** Builds { "<fieldKey>": { id, label } } for every relation field on the
 *  given records, so lists can show names instead of raw ids. */
async function resolveRelationLabels(fields, records) {
  const relationFields = fields.filter((f) => f.type === "relation" && f.options?.section_id);
  if (!relationFields.length || !records.length) return records.map(() => ({}));

  const wanted = new Map(); // sectionId -> Set of ids
  for (const field of relationFields) {
    const sectionId = field.options.section_id;
    if (!wanted.has(sectionId)) wanted.set(sectionId, new Set());
    for (const rec of records) {
      const id = rec.data?.[field.key];
      if (id) wanted.get(sectionId).add(Number(id));
    }
  }

  const labelsBySection = new Map();
  for (const [sectionId, idSet] of wanted) {
    if (!idSet.size) {
      labelsBySection.set(sectionId, new Map());
      continue;
    }
    const [targetFields, targetRecords] = await Promise.all([
      pool.query("SELECT * FROM fields WHERE section_id = $1 ORDER BY sort_order, id", [sectionId]),
      pool.query("SELECT * FROM records WHERE section_id = $1 AND id = ANY($2::int[])", [sectionId, [...idSet]]),
    ]);
    const map = new Map();
    for (const rec of targetRecords.rows) map.set(rec.id, recordTitle(targetFields.rows, rec));
    labelsBySection.set(sectionId, map);
  }

  return records.map((rec) => {
    const out = {};
    for (const field of relationFields) {
      const id = rec.data?.[field.key];
      if (!id) continue;
      out[field.key] = {
        id: Number(id),
        label: labelsBySection.get(field.options.section_id)?.get(Number(id)) || `#${id}`,
      };
    }
    return out;
  });
}

module.exports = { FIELD_TYPES, TEXTUAL_TYPES, validateRecordData, recordTitle, resolveRelationLabels };
