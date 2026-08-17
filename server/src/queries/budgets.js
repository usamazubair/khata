const { pool } = require("../db");

// price minus this month's transactions in the budget's category = remaining.
// Pass onlyId to fetch a single budget (used right after create/update).
// Pass activeOnly to restrict to active budgets (used by mobile-facing reads).
async function listBudgets(monthDate, { onlyId = null, activeOnly = false, q = null } = {}) {
  const params = [monthDate];
  const clauses = [];
  if (onlyId) {
    params.push(onlyId);
    clauses.push(`b.id = $${params.length}`);
  }
  if (activeOnly) {
    clauses.push(`b.active = true`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`b.name ILIKE $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.slug, b.description, b.price, b.active,
            b.category_id, c.name AS category_name, c.color AS category_color,
            COALESCE(SUM(t.amount), 0) AS spent,
            b.price - COALESCE(SUM(t.amount), 0) AS remaining
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t
       ON t.category_id = b.category_id
      AND date_trunc('month', t.occurred_on) = date_trunc('month', $1::date)
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     GROUP BY b.id, c.name, c.color, c.sort_order
     ORDER BY c.sort_order`,
    params
  );
  return rows;
}

module.exports = { listBudgets };
