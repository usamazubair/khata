const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

// Fixed bills, annotated with whether *this month's* instance has been logged yet.
router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT f.id, f.name, f.amount, f.due_day, f.active,
            f.category_id, c.name AS category_name, c.color AS category_color,
            t.id AS transaction_id, t.is_paid
     FROM fixed_expenses f
     JOIN categories c ON c.id = f.category_id
     LEFT JOIN transactions t
       ON t.fixed_expense_id = f.id
      AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)
     WHERE f.active
     ORDER BY f.due_day, f.name`,
    [`${month}-01`]
  );
  res.json(
    rows.map((r) => ({
      ...r,
      status: r.transaction_id ? (r.is_paid ? "paid" : "due") : "unlogged",
    }))
  );
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, category_id, amount, due_day, active = true } = req.body;
  if (!name || !category_id || amount === undefined || !due_day) {
    return res.status(400).json({ error: "name, category_id, amount, and due_day are required." });
  }
  const { rows } = await pool.query(
    `INSERT INTO fixed_expenses (name, category_id, amount, due_day, active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, category_id, amount, due_day, active]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, category_id, amount, due_day, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE fixed_expenses SET
       name = COALESCE($1, name),
       category_id = COALESCE($2, category_id),
       amount = COALESCE($3, amount),
       due_day = COALESCE($4, due_day),
       active = COALESCE($5, active)
     WHERE id = $6 RETURNING *`,
    [name, category_id, amount, due_day, active, req.params.id]
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
