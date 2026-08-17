const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { TEXTUAL_TYPES, validateRecordData, recordTitle, resolveRelationLabels } = require("../fieldTypes");
const { withModuleAccess, moduleIdForSection, moduleIdForRecord } = require("../moduleAccess");

const router = express.Router();

async function fieldsForSection(sectionId) {
  const { rows } = await pool.query("SELECT * FROM fields WHERE section_id = $1 ORDER BY sort_order, id", [
    sectionId,
  ]);
  return rows;
}

// Attaches the display title and resolved relation labels so a client can
// render a row without fetching anything else.
async function decorate(fields, rows) {
  const labels = await resolveRelationLabels(fields, rows);
  return rows.map((r, i) => ({ ...r, title: recordTitle(fields, r), relations: labels[i] }));
}

router.get(
  "/sections/:id/records",
  withModuleAccess(async (req) => moduleIdForSection(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const sectionId = Number(req.params.id);
    const { q, active } = req.query;
    const fields = await fieldsForSection(sectionId);

    const params = [sectionId];
    const clauses = ["section_id = $1"];

    if (active === "true" || active === "false") {
      params.push(active === "true");
      clauses.push(`active = $${params.length}`);
    }

    // Search spans every text-ish field's stored value.
    if (q && String(q).trim()) {
      const searchable = fields.filter((f) => TEXTUAL_TYPES.has(f.type));
      if (searchable.length) {
        params.push(`%${String(q).trim()}%`);
        const idx = params.length;
        clauses.push(`(${searchable.map((f) => `data->>'${f.key}' ILIKE $${idx}`).join(" OR ")})`);
      } else {
        clauses.push("false");
      }
    }

    const { rows } = await pool.query(
      `SELECT * FROM records WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC`,
      params
    );
    res.json(await decorate(fields, rows));
  })
);

router.post(
  "/sections/:id/records",
  withModuleAccess(async (req) => moduleIdForSection(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const sectionId = Number(req.params.id);
    const fields = await fieldsForSection(sectionId);
    if (!fields.length) {
      return res.status(400).json({ error: "This section has no fields yet — add some before adding records." });
    }

    const { data, errors } = await validateRecordData(fields, req.body?.data ?? req.body);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const { rows } = await pool.query(
      "INSERT INTO records (section_id, data, active) VALUES ($1, $2, $3) RETURNING *",
      [sectionId, data, req.body?.active ?? true]
    );
    res.status(201).json((await decorate(fields, rows))[0]);
  })
);

router.put(
  "/records/:id",
  withModuleAccess(async (req) => moduleIdForRecord(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { rows: existing } = await pool.query("SELECT * FROM records WHERE id = $1", [req.params.id]);
    const record = existing[0];
    if (!record) return res.status(404).json({ error: "Record not found." });

    const fields = await fieldsForSection(record.section_id);
    const payload = req.body?.data ?? req.body;
    let data = record.data;

    // A body with only { active } toggles status without revalidating fields,
    // so the active switch keeps working on records with required fields.
    if (payload && Object.keys(payload).some((k) => k !== "active")) {
      const result = await validateRecordData(fields, payload);
      if (result.errors.length) return res.status(400).json({ error: result.errors[0], errors: result.errors });
      data = result.data;
    }

    const { rows } = await pool.query(
      `UPDATE records SET data = $1, active = COALESCE($2, active), updated_at = now()
       WHERE id = $3 RETURNING *`,
      [data, req.body?.active ?? null, req.params.id]
    );
    res.json((await decorate(fields, rows))[0]);
  })
);

router.delete(
  "/records/:id",
  withModuleAccess(async (req) => moduleIdForRecord(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM records WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Record not found." });
    res.status(204).end();
  })
);

module.exports = router;
