const { pool } = require("../db");

// price minus everything ever logged against the goal's category = remaining.
// Pass onlyId to fetch a single goal (used right after create/update).
// Pass activeOnly to restrict to active goals (used by mobile-facing reads).
async function listGoals({ onlyId = null, activeOnly = false, q = null } = {}) {
  const clauses = [];
  const params = [];
  if (onlyId) {
    params.push(onlyId);
    clauses.push(`g.id = $${params.length}`);
  }
  if (activeOnly) {
    clauses.push(`g.active = true`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`g.name ILIKE $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.slug, g.description, g.price, g.target_date, g.active,
            g.category_id, c.name AS category_name, c.color AS category_color,
            COALESCE(SUM(t.amount), 0) AS saved,
            g.price - COALESCE(SUM(t.amount), 0) AS remaining
     FROM goals g
     JOIN categories c ON c.id = g.category_id
     LEFT JOIN transactions t ON t.category_id = g.category_id
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     GROUP BY g.id, c.name, c.color
     ORDER BY g.target_date NULLS LAST, g.id`,
    params
  );
  return rows;
}

module.exports = { listGoals };
