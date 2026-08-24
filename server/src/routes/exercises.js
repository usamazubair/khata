const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { active, q } = req.query;
  const clauses = [];
  const params = [];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`active = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    clauses.push(`(name ILIKE $${params.length} OR muscle_group ILIKE $${params.length} OR equipment ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM exercises ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY sort_order, name`,
    params
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, muscle_group = "", equipment = "", notes = "", active = true } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Exercise name is required." });
  try {
    const { rows: last } = await pool.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM exercises");
    const { rows } = await pool.query(
      `INSERT INTO exercises (name, slug, muscle_group, equipment, notes, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [String(name).trim(), await uniqueSlug("exercises", name), muscle_group, equipment, notes, last[0].next, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "An exercise with that name already exists." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, muscle_group, equipment, notes, sort_order, active } = req.body;
  const slug = name ? await uniqueSlug("exercises", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE exercises SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       muscle_group = COALESCE($3, muscle_group),
       equipment = COALESCE($4, equipment),
       notes = COALESCE($5, notes),
       sort_order = COALESCE($6, sort_order),
       active = COALESCE($7, active)
     WHERE id = $8 RETURNING *`,
    [name, slug, muscle_group, equipment, notes, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Exercise not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM exercises WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Exercise not found." });
    res.status(204).end();
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This exercise is used by logged sets — deactivate it instead." });
    }
    throw err;
  }
}));

module.exports = router;
