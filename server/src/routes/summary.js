const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { listBudgets } = require("../queries/budgets");
const { listGoals } = require("../queries/goals");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const monthDate = `${month}-01`;

  const [
    totalExpense,
    totalSaved,
    byCategory,
    recent,
    totalCategories,
    totalTransactions,
    archives,
    budgets,
    goals,
  ] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE c.type != 'saved' AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)`,
      [monthDate]
    ),
    pool.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE c.type = 'saved' AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)`,
      [monthDate]
    ),
    pool.query(
      `SELECT c.id AS category_id, c.name, c.color, COALESCE(SUM(t.amount), 0) AS total
       FROM categories c
       LEFT JOIN transactions t
         ON t.category_id = c.id
        AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)
       WHERE c.type = 'expense'
       GROUP BY c.id, c.name, c.color, c.sort_order
       HAVING COALESCE(SUM(t.amount), 0) > 0
       ORDER BY total DESC`,
      [monthDate]
    ),
    pool.query(
      `SELECT t.id, t.description, t.amount, t.is_paid, t.occurred_on,
              c.name AS category_name, c.color AS category_color, c.type AS category_type
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       ORDER BY t.occurred_on DESC, t.created_at DESC
       LIMIT 10`
    ),
    pool.query("SELECT COUNT(*) AS total FROM categories"),
    pool.query(
      `SELECT COUNT(*) AS total FROM transactions
       WHERE date_trunc('month', occurred_on) = date_trunc('month', $1::date)`,
      [monthDate]
    ),
    pool.query(
      `SELECT to_char(date_trunc('month', occurred_on), 'YYYY-MM') AS month,
              SUM(amount) AS total, COUNT(*) AS count
       FROM transactions
       WHERE occurred_on < date_trunc('month', $1::date)
       GROUP BY date_trunc('month', occurred_on)
       ORDER BY date_trunc('month', occurred_on) DESC
       LIMIT 6`,
      [monthDate]
    ),
    listBudgets(monthDate),
    listGoals(),
  ]);

  res.json({
    month,
    total_expense: Number(totalExpense.rows[0].total),
    total_saved: Number(totalSaved.rows[0].total),
    total_categories: Number(totalCategories.rows[0].total),
    total_transactions: Number(totalTransactions.rows[0].total),
    by_category: byCategory.rows.map((r) => ({ ...r, total: Number(r.total) })),
    recent: recent.rows,
    archives: archives.rows.map((r) => ({ ...r, total: Number(r.total), count: Number(r.count) })),
    budgets: budgets.map((b) => ({ ...b, price: Number(b.price), spent: Number(b.spent), remaining: Number(b.remaining) })),
    goals: goals.map((g) => ({ ...g, price: Number(g.price), saved: Number(g.saved), remaining: Number(g.remaining) })),
  });
}));

module.exports = router;
