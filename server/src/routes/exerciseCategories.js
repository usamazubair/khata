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
    clauses.push(`name ILIKE $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM exercise_categories
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY sort_order, name`,
    params
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, color = "#2f6bff", sort_order = 0, active = true } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });
  try {
    const slug = await uniqueSlug("exercise_categories", name);
    const { rows } = await pool.query(
      `INSERT INTO exercise_categories (name, slug, color, sort_order, active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [String(name).trim(), slug, color, sort_order, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A category with that name already exists." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, color, sort_order, active } = req.body;
  const slug = name ? await uniqueSlug("exercise_categories", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE exercise_categories SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       color = COALESCE($3, color),
       sort_order = COALESCE($4, sort_order),
       active = COALESCE($5, active)
     WHERE id = $6 RETURNING *`,
    [name, slug, color, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Category not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM exercise_categories WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Category not found." });
    res.status(204).end();
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This category is used by existing exercises — deactivate it instead." });
    }
    throw err;
  }
}));

module.exports = router;
