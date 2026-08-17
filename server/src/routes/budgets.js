const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color,
            b.month, b.limit_amount,
            COALESCE(SUM(t.amount), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t
       ON t.category_id = b.category_id
      AND date_trunc('month', t.occurred_on) = date_trunc('month', b.month)
     WHERE date_trunc('month', b.month) = date_trunc('month', $1::date)
     GROUP BY b.id, c.name, c.color, c.sort_order
     ORDER BY c.sort_order`,
    [`${month}-01`]
  );
  res.json(rows);
}));

// Create or update the budget for a category/month in one call.
router.post("/", asyncHandler(async (req, res) => {
  const { category_id, month, limit_amount } = req.body;
  if (!category_id || !month || limit_amount === undefined) {
    return res.status(400).json({ error: "category_id, month, and limit_amount are required." });
  }
  const { rows } = await pool.query(
    `INSERT INTO budgets (category_id, month, limit_amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (category_id, month) DO UPDATE SET limit_amount = EXCLUDED.limit_amount
     RETURNING *`,
    [category_id, `${month}-01`, limit_amount]
  );
  res.status(201).json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM budgets WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Budget not found." });
  res.status(204).end();
}));

module.exports = router;
