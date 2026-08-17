const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");
const { listGoals } = require("../queries/goals");

const router = express.Router();

async function assertCategoryType(category_id, type) {
  const { rows } = await pool.query("SELECT type FROM categories WHERE id = $1", [category_id]);
  if (!rows[0]) return `category_id ${category_id} does not exist.`;
  if (rows[0].type !== type) return `That category is type "${rows[0].type}", not "${type}".`;
  return null;
}

router.get("/", asyncHandler(async (req, res) => {
  res.json(await listGoals());
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, description = "", price, category_id, target_date = null } = req.body;
  if (!name || price === undefined || !category_id) {
    return res.status(400).json({ error: "name, price, and category_id are required." });
  }
  const typeError = await assertCategoryType(category_id, "saved");
  if (typeError) return res.status(400).json({ error: typeError });

  try {
    const slug = await uniqueSlug("goals", name);
    const { rows } = await pool.query(
      `INSERT INTO goals (name, slug, description, price, category_id, target_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, slug, description, price, category_id, target_date]
    );
    const [full] = await listGoals(rows[0].id);
    res.status(201).json(full);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That category already has a goal." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, description, price, category_id, target_date } = req.body;
  if (category_id) {
    const typeError = await assertCategoryType(category_id, "saved");
    if (typeError) return res.status(400).json({ error: typeError });
  }
  const slug = name ? await uniqueSlug("goals", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE goals SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       description = COALESCE($3, description),
       price = COALESCE($4, price),
       category_id = COALESCE($5, category_id),
       target_date = COALESCE($6, target_date)
     WHERE id = $7 RETURNING id`,
    [name, slug, description, price, category_id, target_date, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Goal not found." });
  const [full] = await listGoals(req.params.id);
  res.json(full);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM goals WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Goal not found." });
  res.status(204).end();
}));

module.exports = router;
