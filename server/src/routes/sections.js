const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { requireAdmin } = require("../auth");
const { uniqueSlug } = require("../slugify");
const { FIELD_TYPES } = require("../fieldTypes");
const { withModuleAccess, moduleIdForSection, moduleIdForField } = require("../moduleAccess");

const router = express.Router();

// Slugs are unique per module, not globally, so uniqueSlug's table-wide check
// isn't right here — scope the candidates to this module.
async function sectionSlug(moduleId, name, excludeId = null) {
  const base =
    String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section";
  const { rows } = await pool.query(
    "SELECT slug FROM sections WHERE module_id = $1 AND (slug = $2 OR slug LIKE $2 || '-%')",
    [moduleId, base]
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (excludeId) {
    const { rows: own } = await pool.query("SELECT slug FROM sections WHERE id = $1", [excludeId]);
    if (own[0]) taken.delete(own[0].slug);
  }
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

async function fieldsFor(sectionIds) {
  if (!sectionIds.length) return new Map();
  const { rows } = await pool.query(
    "SELECT * FROM fields WHERE section_id = ANY($1::int[]) ORDER BY sort_order, id",
    [sectionIds]
  );
  const map = new Map(sectionIds.map((id) => [id, []]));
  for (const f of rows) map.get(f.section_id)?.push(f);
  return map;
}

/* ── sections of a module ───────────────────────────────────────────────── */

router.get(
  "/modules/:moduleId/sections",
  withModuleAccess(async (req) => Number(req.params.moduleId)),
  asyncHandler(async (req, res) => {
    const onlyActive = req.query.active === "true";
    const { rows } = await pool.query(
      `SELECT * FROM sections WHERE module_id = $1 ${onlyActive ? "AND active" : ""} ORDER BY sort_order, name`,
      [req.params.moduleId]
    );
    const byId = await fieldsFor(rows.map((s) => s.id));
    res.json(rows.map((s) => ({ ...s, fields: byId.get(s.id) || [] })));
  })
);

router.post(
  "/modules/:moduleId/sections",
  requireAdmin,
  withModuleAccess(async (req) => Number(req.params.moduleId)),
  asyncHandler(async (req, res) => {
    const { name, icon = "📄", sort_order } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Section name is required." });

    const moduleId = Number(req.params.moduleId);
    const { rows: last } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM sections WHERE module_id = $1",
      [moduleId]
    );
    const { rows } = await pool.query(
      `INSERT INTO sections (module_id, name, slug, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [moduleId, String(name).trim(), await sectionSlug(moduleId, name), icon, sort_order ?? last[0].next]
    );
    res.status(201).json({ ...rows[0], fields: [] });
  })
);

router.put(
  "/sections/:id",
  requireAdmin,
  withModuleAccess(async (req) => moduleIdForSection(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { name, icon, sort_order, active } = req.body;
    const slug = name ? await sectionSlug(req.moduleId, name, req.params.id) : null;
    const { rows } = await pool.query(
      `UPDATE sections SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug),
         icon = COALESCE($3, icon),
         sort_order = COALESCE($4, sort_order),
         active = COALESCE($5, active)
       WHERE id = $6 RETURNING *`,
      [name, slug, icon, sort_order, active, req.params.id]
    );
    res.json(rows[0]);
  })
);

router.delete(
  "/sections/:id",
  requireAdmin,
  withModuleAccess(async (req) => moduleIdForSection(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    // Built-in sections front a hand-built page, so removing the row would
    // orphan a page that still exists. Hide it instead.
    const { rows: section } = await pool.query("SELECT page_key FROM sections WHERE id = $1", [req.params.id]);
    if (section[0]?.page_key) {
      return res.status(409).json({ error: "This is a built-in page — hide it instead of deleting it." });
    }

    // Fields and records cascade — warn the caller how much goes with it.
    const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM records WHERE section_id = $1", [
      req.params.id,
    ]);
    if (rows[0].total > 0 && req.query.confirm !== "true") {
      return res.status(409).json({
        error: `This section holds ${rows[0].total} record${rows[0].total === 1 ? "" : "s"} that would be deleted too.`,
        requires_confirm: true,
      });
    }
    await pool.query("DELETE FROM sections WHERE id = $1", [req.params.id]);
    res.status(204).end();
  })
);

/* ── fields of a section ────────────────────────────────────────────────── */

router.post(
  "/sections/:id/fields",
  requireAdmin,
  withModuleAccess(async (req) => moduleIdForSection(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { name, type, required = false, options = {}, sort_order } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Field name is required." });

    // Built-in pages draw their own layout — fields would have nothing to render into.
    const { rows: owner } = await pool.query("SELECT page_key FROM sections WHERE id = $1", [req.params.id]);
    if (owner[0]?.page_key) {
      return res.status(409).json({ error: "Built-in pages have their own layout — fields can't be added to them." });
    }
    if (!FIELD_TYPES.includes(type)) {
      return res.status(400).json({ error: `Field type must be one of: ${FIELD_TYPES.join(", ")}.` });
    }
    if (type === "select" && !(options.choices?.length > 0)) {
      return res.status(400).json({ error: "A dropdown needs at least one choice." });
    }
    if (type === "relation") {
      if (!options.section_id) return res.status(400).json({ error: "A link field needs a section to point at." });
      const { rows } = await pool.query("SELECT 1 FROM sections WHERE id = $1", [options.section_id]);
      if (!rows.length) return res.status(400).json({ error: "That section doesn't exist." });
    }

    const sectionId = Number(req.params.id);
    const key = await fieldKey(sectionId, name);
    const { rows: last } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM fields WHERE section_id = $1",
      [sectionId]
    );
    const { rows } = await pool.query(
      `INSERT INTO fields (section_id, name, key, type, required, options, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [sectionId, String(name).trim(), key, type, required, options, sort_order ?? last[0].next]
    );
    res.status(201).json(rows[0]);
  })
);

async function fieldKey(sectionId, name) {
  const base =
    String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "field";
  const { rows } = await pool.query("SELECT key FROM fields WHERE section_id = $1", [sectionId]);
  const taken = new Set(rows.map((r) => r.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// The key stays fixed once created — renaming it would orphan every stored
// value — so only presentation and validation settings are editable.
router.put(
  "/fields/:id",
  requireAdmin,
  withModuleAccess(async (req) => moduleIdForField(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { name, required, options, sort_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE fields SET
         name = COALESCE($1, name),
         required = COALESCE($2, required),
         options = COALESCE($3, options),
         sort_order = COALESCE($4, sort_order)
       WHERE id = $5 RETURNING *`,
      [name, required, options, sort_order, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Field not found." });
    res.json(rows[0]);
  })
);

router.delete(
  "/fields/:id",
  requireAdmin,
  withModuleAccess(async (req) => moduleIdForField(Number(req.params.id))),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM fields WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Field not found." });
    res.status(204).end();
  })
);

module.exports = router;
