const { pool } = require("./db");

function baseSlug(name) {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

// Appends -2, -3, ... until the slug is free in `table`, ignoring `excludeId`
// (so renaming a row to a slug it already owns doesn't collide with itself).
async function uniqueSlug(table, name, excludeId = null) {
  const base = baseSlug(name);
  const { rows } = await pool.query(
    `SELECT slug FROM ${table} WHERE slug = $1 OR slug LIKE $1 || '-%'`,
    [base]
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (excludeId) {
    const { rows: own } = await pool.query(`SELECT slug FROM ${table} WHERE id = $1`, [excludeId]);
    if (own[0]) taken.delete(own[0].slug);
  }
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

module.exports = { uniqueSlug };
