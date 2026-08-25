const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");

const router = express.Router();

/* ── lists ─────────────────────────────────────────────────────────────── */
// Each list carries its own open/done counts and the next thing due on it, so
// the board can be drawn from one request instead of one per card.
router.get("/lists", asyncHandler(async (req, res) => {
  const { active, q } = req.query;
  const clauses = [];
  const params = [];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`l.active = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`l.name ILIKE $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.slug, l.icon, l.color, l.sort_order, l.active,
            COUNT(i.id) FILTER (WHERE NOT i.done)::int AS open_count,
            COUNT(i.id) FILTER (WHERE i.done)::int     AS done_count,
            COUNT(i.id) FILTER (WHERE NOT i.done AND i.due_date < CURRENT_DATE)::int AS overdue_count,
            MIN(i.due_date) FILTER (WHERE NOT i.done)  AS next_due
     FROM todo_lists l
     LEFT JOIN todo_items i ON i.list_id = l.id
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     GROUP BY l.id
     ORDER BY l.sort_order, l.name`,
    params
  );
  res.json(rows);
}));

router.post("/lists", asyncHandler(async (req, res) => {
  const { name, icon = "🗂️", color = "#2f6bff", sort_order = 0, active = true } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "A name is required." });
  try {
    const slug = await uniqueSlug("todo_lists", name);
    const { rows } = await pool.query(
      `INSERT INTO todo_lists (name, slug, icon, color, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), slug, icon, color, sort_order, active]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A list with that name already exists." });
    throw err;
  }
}));

router.put("/lists/:id", asyncHandler(async (req, res) => {
  const { name, icon, color, sort_order, active } = req.body;
  const slug = name ? await uniqueSlug("todo_lists", name, req.params.id) : null;
  const { rows } = await pool.query(
    `UPDATE todo_lists SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       icon = COALESCE($3, icon),
       color = COALESCE($4, color),
       sort_order = COALESCE($5, sort_order),
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING *`,
    [name, slug, icon, color, sort_order, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "List not found." });
  res.json(rows[0]);
}));

// Deleting a list takes its items with it (ON DELETE CASCADE), so say so
// plainly rather than letting it look like a tidy no-op.
router.delete("/lists/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM todo_lists WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "List not found." });
  res.status(204).end();
}));

/* ── items ─────────────────────────────────────────────────────────────── */
// Open first, then by priority, then by what's due soonest. NULLS LAST keeps
// undated tasks from crowding out the ones with a deadline.
const ITEM_ORDER = `ORDER BY i.done, i.priority DESC, i.due_date ASC NULLS LAST, i.sort_order, i.id`;

router.get("/items", asyncHandler(async (req, res) => {
  const { list_id, done, q, due_before } = req.query;
  const clauses = [];
  const params = [];
  if (list_id) {
    params.push(Number(list_id));
    clauses.push(`i.list_id = $${params.length}`);
  }
  if (done === "true" || done === "false") {
    params.push(done === "true");
    clauses.push(`i.done = $${params.length}`);
  }
  if (due_before) {
    params.push(due_before);
    clauses.push(`i.due_date <= $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(i.title ILIKE $${params.length} OR i.notes ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT i.*, l.name AS list_name, l.color AS list_color, l.icon AS list_icon
     FROM todo_items i
     JOIN todo_lists l ON l.id = i.list_id
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ${ITEM_ORDER}`,
    params
  );
  res.json(rows);
}));

router.post("/items", asyncHandler(async (req, res) => {
  const { list_id, title, notes = "", due_date = null, priority = 0, sort_order = 0 } = req.body;
  if (!list_id || !title || !title.trim()) {
    return res.status(400).json({ error: "list_id and title are required." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO todo_items (list_id, title, notes, due_date, priority, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [list_id, title.trim(), notes, due_date, priority, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23503") return res.status(400).json({ error: "That list doesn't exist." });
    throw err;
  }
}));

router.put("/items/:id", asyncHandler(async (req, res) => {
  const { list_id, title, notes, priority, done, sort_order } = req.body;
  // A cleared due date is a real value, so presence in the body decides
  // whether we touch it — COALESCE would read null as "leave it".
  const touchingDue = "due_date" in req.body;
  const touchingDone = typeof done === "boolean";

  const { rows } = await pool.query(
    `UPDATE todo_items SET
       list_id = COALESCE($1, list_id),
       title = COALESCE($2, title),
       notes = COALESCE($3, notes),
       due_date = CASE WHEN $4::boolean THEN $5::date ELSE due_date END,
       priority = COALESCE($6, priority),
       done = COALESCE($7, done),
       -- done_at only moves when done actually flips, so re-editing a
       -- finished task doesn't rewrite when it was finished.
       done_at = CASE WHEN $8::boolean AND $7 IS DISTINCT FROM done
                      THEN (CASE WHEN $7 THEN now() ELSE NULL END)
                      ELSE done_at END,
       sort_order = COALESCE($9, sort_order)
     WHERE id = $10 RETURNING *`,
    [list_id, title, notes, touchingDue, touchingDue ? req.body.due_date : null,
     priority, done, touchingDone, sort_order, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Task not found." });
  res.json(rows[0]);
}));

router.delete("/items/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM todo_items WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Task not found." });
  res.status(204).end();
}));

// Clearing out everything already ticked off on one list.
router.delete("/lists/:id/done", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM todo_items WHERE list_id = $1 AND done", [req.params.id]);
  res.json({ deleted: rowCount });
}));

module.exports = router;
