const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

const SELECT = `
  SELECT t.id, t.category_id, c.name AS category_name, c.color AS category_color, c.type AS category_type,
         t.description, t.amount, t.is_paid, t.occurred_on, t.created_at, t.fixed_expense_id
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
`;

router.get("/", asyncHandler(async (req, res) => {
  const { month, category_id, paid, limit } = req.query;
  const clauses = [];
  const params = [];

  if (month) {
    params.push(`${month}-01`);
    clauses.push(`date_trunc('month', t.occurred_on) = date_trunc('month', $${params.length}::date)`);
  }
  if (category_id) {
    params.push(category_id);
    clauses.push(`t.category_id = $${params.length}`);
  }
  if (paid === "true" || paid === "false") {
    params.push(paid === "true");
    clauses.push(`t.is_paid = $${params.length}`);
  }

  let sql = SELECT + (clauses.length ? `WHERE ${clauses.join(" AND ")} ` : "") + "ORDER BY t.occurred_on DESC, t.created_at DESC";
  if (limit) {
    params.push(Number(limit));
    sql += ` LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { category_id, description = "", amount, is_paid = true, occurred_on, fixed_expense_id = null } = req.body;
  if (!category_id || amount === undefined) {
    return res.status(400).json({ error: "category_id and amount are required." });
  }
  const { rows } = await pool.query(
    `INSERT INTO transactions (category_id, description, amount, is_paid, occurred_on, fixed_expense_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6) RETURNING id, created_at`,
    [category_id, description, amount, is_paid, occurred_on, fixed_expense_id]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { category_id, description, amount, is_paid, occurred_on } = req.body;
  const { rows } = await pool.query(
    `UPDATE transactions SET
       category_id = COALESCE($1, category_id),
       description = COALESCE($2, description),
       amount = COALESCE($3, amount),
       is_paid = COALESCE($4, is_paid),
       occurred_on = COALESCE($5, occurred_on)
     WHERE id = $6 RETURNING *`,
    [category_id, description, amount, is_paid, occurred_on, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Transaction not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM transactions WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Transaction not found." });
  res.status(204).end();
}));

module.exports = router;
