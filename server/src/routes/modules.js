const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { requireAdmin } = require("../auth");

const router = express.Router();

// Modules are a fixed, hand-built set — they're enabled or disabled, not
// created. Admins see all of them; members see only the ones granted to them.
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

// Only the on/off switch and presentation are editable.
router.put("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { description, icon, sort_order, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE modules SET
       description = COALESCE($1, description),
       icon = COALESCE($2, icon),
       sort_order = COALESCE($3, sort_order),
       active = COALESCE($4, active)
     WHERE id = $5 RETURNING *`,
    [description, icon, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Module not found." });
  res.json(rows[0]);
}));

module.exports = router;
