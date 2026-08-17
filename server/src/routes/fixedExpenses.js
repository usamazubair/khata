const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");

const router = express.Router();

async function assertCategoryType(category_id, type) {
  const { rows } = await pool.query("SELECT type FROM categories WHERE id = $1", [category_id]);
  if (!rows[0]) return `category_id ${category_id} does not exist.`;
  if (rows[0].type !== type) return `That category is type "${rows[0].type}", not "${type}".`;
  return null;
}

// Fixed bills, annotated with whether *this month's* instance has been logged yet.
// By default returns both active and inactive (the web page manages both);
// pass ?active=true to get only the ones that should reach the mobile app.
router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { active, q } = req.query;
  const clauses = [];
  const params = [`${month}-01`];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`f.active = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(f.name ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT f.id, f.name, f.slug, f.description, f.amount, f.due_day, f.active,
            f.category_id, c.name AS category_name, c.color AS category_color,
            t.id AS transaction_id, t.is_paid
     FROM fixed_expenses f
     JOIN categories c ON c.id = f.category_id
     LEFT JOIN transactions t
       ON t.fixed_expense_id = f.id
      AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY f.due_day, f.name`,
    params
  );
  res.json(
    rows.map((r) => ({
      ...r,
      status: r.transaction_id ? (r.is_paid ? "paid" : "due") : "unlogged",
    }))
  );
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, description = "", category_id, amount, due_day, active = true } = req.body;
  if (!name || !category_id || amount === undefined || !due_day) {
    return res.status(400).json({ error: "name, category_id, amount, and due_day are required." });
  }
  const typeError = await assertCategoryType(category_id, "fixed");
  if (typeError) return res.status(400).json({ error: typeError });

  const slug = await uniqueSlug("fixed_expenses", name);
  const { rows } = await pool.query(
    `INSERT INTO fixed_expenses (name, slug, description, category_id, amount, due_day, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, slug, description, category_id, amount, due_day, active]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, description, category_id, amount, due_day, active } = req.body;
  if (category_id) {
    const typeError = await assertCategoryType(category_id, "fixed");
    if (typeError) return res.status(400).json({ error: typeError });
  }
  const slug = name ? await uniqueSlug("fixed_expenses", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE fixed_expenses SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       description = COALESCE($3, description),
       category_id = COALESCE($4, category_id),
       amount = COALESCE($5, amount),
       due_day = COALESCE($6, due_day),
       active = COALESCE($7, active)
     WHERE id = $8 RETURNING *`,
    [name, slug, description, category_id, amount, due_day, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Fixed bill not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM fixed_expenses WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Fixed bill not found." });
  res.status(204).end();
}));

// Logs this month's occurrence of a fixed bill as an actual transaction.
router.post("/:id/confirm", asyncHandler(async (req, res) => {
  const { rows: bills } = await pool.query("SELECT * FROM fixed_expenses WHERE id = $1", [req.params.id]);
  const bill = bills[0];
  if (!bill) return res.status(404).json({ error: "Fixed bill not found." });

  const occurred_on = req.body.occurred_on || new Date().toISOString().slice(0, 10);
  const is_paid = req.body.is_paid ?? true;

  const { rows } = await pool.query(
    `INSERT INTO transactions (category_id, description, amount, is_paid, occurred_on, fixed_expense_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [bill.category_id, bill.name, bill.amount, is_paid, occurred_on, bill.id]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
