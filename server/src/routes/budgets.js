const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");
const { listBudgets } = require("../queries/budgets");

const router = express.Router();

async function assertCategoryType(category_id, type) {
  const { rows } = await pool.query("SELECT type FROM categories WHERE id = $1", [category_id]);
  if (!rows[0]) return `category_id ${category_id} does not exist.`;
  if (rows[0].type !== type) return `That category is type "${rows[0].type}", not "${type}".`;
  return null;
}

// By default returns both active and inactive (the web page manages both);
// pass ?active=true to get only the ones that should reach the mobile app.
router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { active, q } = req.query;
  res.json(await listBudgets(`${month}-01`, { activeOnly: active === "true", q }));
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, description = "", price, category_id, active = true } = req.body;
  if (!name || price === undefined || !category_id) {
    return res.status(400).json({ error: "name, price, and category_id are required." });
  }
  const typeError = await assertCategoryType(category_id, "budget");
  if (typeError) return res.status(400).json({ error: typeError });

  try {
    const slug = await uniqueSlug("budgets", name);
    const { rows } = await pool.query(
      `INSERT INTO budgets (name, slug, description, price, category_id, active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, slug, description, price, category_id, active]
    );
    const [full] = await listBudgets(`${new Date().toISOString().slice(0, 7)}-01`, { onlyId: rows[0].id });
    res.status(201).json(full);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That category already has a budget." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, description, price, category_id, active } = req.body;
  if (category_id) {
    const typeError = await assertCategoryType(category_id, "budget");
    if (typeError) return res.status(400).json({ error: typeError });
  }
  const slug = name ? await uniqueSlug("budgets", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE budgets SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       description = COALESCE($3, description),
       price = COALESCE($4, price),
       category_id = COALESCE($5, category_id),
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING id`,
    [name, slug, description, price, category_id, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Budget not found." });
  const [full] = await listBudgets(`${new Date().toISOString().slice(0, 7)}-01`, { onlyId: req.params.id });
  res.json(full);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM budgets WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Budget not found." });
  res.status(204).end();
}));

module.exports = router;
