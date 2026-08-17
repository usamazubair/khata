const { pool } = require("../db");

// price minus everything ever logged against the goal's category = remaining.
// Pass onlyId to fetch a single goal (used right after create/update).
async function listGoals(onlyId = null) {
  const params = [];
  let where = "";
  if (onlyId) {
    params.push(onlyId);
    where = `WHERE g.id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.slug, g.description, g.price, g.target_date,
            g.category_id, c.name AS category_name, c.color AS category_color,
            COALESCE(SUM(t.amount), 0) AS saved,
            g.price - COALESCE(SUM(t.amount), 0) AS remaining
     FROM goals g
     JOIN categories c ON c.id = g.category_id
     LEFT JOIN transactions t ON t.category_id = g.category_id
     ${where}
     GROUP BY g.id, c.name, c.color
     ORDER BY g.target_date NULLS LAST, g.id`,
    params
  );
  return rows;
}

module.exports = { listGoals };
