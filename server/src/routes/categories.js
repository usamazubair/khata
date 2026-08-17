const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");

const router = express.Router();
const TYPES = ["fixed", "expense", "saved", "budget"];

router.get("/", asyncHandler(async (req, res) => {
  const { type, active, q } = req.query;
  const clauses = [];
  const params = [];
  if (type) {
    params.push(type);
    clauses.push(`type = $${params.length}`);
  }
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`active = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`name ILIKE $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT id, name, slug, type, color, sort_order, active FROM categories
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY sort_order, name`,
    params
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, type, color, sort_order = 0, active = true } = req.body;
  if (!name || !TYPES.includes(type) || !color) {
    return res.status(400).json({ error: `name, color, and type (one of ${TYPES.join(", ")}) are required.` });
  }
  try {
    const slug = await uniqueSlug("categories", name);
    const { rows } = await pool.query(
      "INSERT INTO categories (name, slug, type, color, sort_order, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, slug, type, color, sort_order, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A category with that name already exists." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, type, color, sort_order, active } = req.body;
  if (type && !TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${TYPES.join(", ")}.` });
  }
  const slug = name ? await uniqueSlug("categories", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE categories SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       type = COALESCE($3, type),
       color = COALESCE($4, color),
       sort_order = COALESCE($5, sort_order),
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING *`,
    [name, slug, type, color, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Category not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Category not found." });
    res.status(204).end();
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This category is used by existing transactions, fixed bills, goals, or budgets." });
    }
    throw err;
  }
}));

module.exports = router;
