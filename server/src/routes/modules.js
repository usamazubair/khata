const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { requireAdmin } = require("../auth");
const { uniqueSlug } = require("../slugify");

const router = express.Router();

// Admins see every module; members only the ones granted to them. Members also
// never see deactivated modules.
router.get("/", asyncHandler(async (req, res) => {
  if (req.user.role === "admin") {
    const { rows } = await pool.query("SELECT * FROM modules ORDER BY sort_order, name");
    return res.json(rows);
  }
  const { rows } = await pool.query(
    `SELECT m.* FROM modules m
     JOIN module_access ma ON ma.module_id = m.id
     WHERE ma.user_id = $1 AND m.active
     ORDER BY m.sort_order, m.name`,
    [req.user.id]
  );
  res.json(rows);
}));

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const { name, description = "", icon = "📦", sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Module name is required." });

  try {
    const slug = await uniqueSlug("modules", name);
    // New modules append to the end rather than landing in front of Khata.
    const { rows: last } = await pool.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM modules");
    const { rows } = await pool.query(
      `INSERT INTO modules (name, slug, description, icon, kind, sort_order)
       VALUES ($1, $2, $3, $4, 'generic', $5) RETURNING *`,
      [name.trim(), slug, description, icon, sort_order ?? last[0].next]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A module with that name already exists." });
    throw err;
  }
}));

router.put("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { name, description, icon, sort_order, active } = req.body;
  const slug = name ? await uniqueSlug("modules", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE modules SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       description = COALESCE($3, description),
       icon = COALESCE($4, icon),
       sort_order = COALESCE($5, sort_order),
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING *`,
    [name, slug, description, icon, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Module not found." });
  res.json(rows[0]);
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT kind FROM modules WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Module not found." });
  if (rows[0].kind === "system") {
    return res.status(409).json({ error: "Built-in modules can't be deleted — deactivate it instead." });
  }
  await pool.query("DELETE FROM modules WHERE id = $1", [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
