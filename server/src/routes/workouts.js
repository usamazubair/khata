const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

// Volume is the standard "weight moved" figure: reps × weight, summed.
const SESSION_SELECT = `
  SELECT s.*,
         COUNT(w.id)::int AS set_count,
         COALESCE(SUM(w.reps * w.weight), 0)::float AS volume,
         COALESCE(SUM(w.reps), 0)::int AS total_reps
  FROM workout_sessions s
  LEFT JOIN workout_sets w ON w.session_id = s.id
`;

/* ── sessions ──────────────────────────────────────────────────────────── */

router.get("/sessions", asyncHandler(async (req, res) => {
  const { q, date_from, date_to, limit } = req.query;
  const clauses = [];
  const params = [];

  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    clauses.push(`(s.name ILIKE $${params.length} OR s.notes ILIKE $${params.length})`);
  }
  if (date_from) {
    params.push(date_from);
    clauses.push(`s.occurred_on >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    clauses.push(`s.occurred_on <= $${params.length}`);
  }

  let sql = `${SESSION_SELECT} ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
             GROUP BY s.id ORDER BY s.occurred_on DESC, s.id DESC`;
  if (limit) {
    params.push(Number(limit));
    sql += ` LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

// One session plus the sets logged in it, in the order they were done.
router.get("/sessions/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE s.id = $1 GROUP BY s.id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Session not found." });

  const { rows: sets } = await pool.query(
    `SELECT w.*, e.name AS exercise_name, e.muscle_group
     FROM workout_sets w
     JOIN exercises e ON e.id = w.exercise_id
     WHERE w.session_id = $1
     ORDER BY w.set_order, w.id`,
    [req.params.id]
  );
  res.json({ ...rows[0], sets });
}));

router.post("/sessions", asyncHandler(async (req, res) => {
  const { name = "", occurred_on, notes = "" } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO workout_sessions (name, occurred_on, notes)
     VALUES ($1, COALESCE($2, CURRENT_DATE), $3) RETURNING *`,
    [name, occurred_on || null, notes]
  );
  res.status(201).json({ ...rows[0], set_count: 0, volume: 0, total_reps: 0, sets: [] });
}));

router.put("/sessions/:id", asyncHandler(async (req, res) => {
  const { name, occurred_on, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE workout_sessions SET
       name = COALESCE($1, name),
       occurred_on = COALESCE($2, occurred_on),
       notes = COALESCE($3, notes)
     WHERE id = $4 RETURNING *`,
    [name, occurred_on, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Session not found." });
  res.json(rows[0]);
}));

router.delete("/sessions/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM workout_sessions WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Session not found." });
  res.status(204).end();
}));

/* ── sets ──────────────────────────────────────────────────────────────── */

router.post("/sessions/:id/sets", asyncHandler(async (req, res) => {
  const { exercise_id, reps, weight = 0 } = req.body;
  if (!exercise_id || reps === undefined || reps === null || reps === "") {
    return res.status(400).json({ error: "Exercise and reps are required." });
  }
  const { rows: session } = await pool.query("SELECT 1 FROM workout_sessions WHERE id = $1", [req.params.id]);
  if (!session.length) return res.status(404).json({ error: "Session not found." });

  const { rows: last } = await pool.query(
    "SELECT COALESCE(MAX(set_order), 0) + 1 AS next FROM workout_sets WHERE session_id = $1",
    [req.params.id]
  );
  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_sets (session_id, exercise_id, reps, weight, set_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, exercise_id, reps, weight, last[0].next]
    );
    const { rows: full } = await pool.query(
      `SELECT w.*, e.name AS exercise_name, e.muscle_group
       FROM workout_sets w JOIN exercises e ON e.id = w.exercise_id WHERE w.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    if (err.code === "23503") return res.status(400).json({ error: "That exercise doesn't exist." });
    throw err;
  }
}));

router.put("/sets/:id", asyncHandler(async (req, res) => {
  const { exercise_id, reps, weight, set_order } = req.body;
  const { rows } = await pool.query(
    `UPDATE workout_sets SET
       exercise_id = COALESCE($1, exercise_id),
       reps = COALESCE($2, reps),
       weight = COALESCE($3, weight),
       set_order = COALESCE($4, set_order)
     WHERE id = $5 RETURNING *`,
    [exercise_id, reps, weight, set_order, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Set not found." });
  const { rows: full } = await pool.query(
    `SELECT w.*, e.name AS exercise_name, e.muscle_group
     FROM workout_sets w JOIN exercises e ON e.id = w.exercise_id WHERE w.id = $1`,
    [rows[0].id]
  );
  res.json(full[0]);
}));

router.delete("/sets/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM workout_sets WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Set not found." });
  res.status(204).end();
}));

/* ── overview ──────────────────────────────────────────────────────────── */

// Weeks run Monday-to-Sunday, which is what date_trunc('week') gives us.
router.get("/summary", asyncHandler(async (req, res) => {
  const [thisWeek, lastWeek, recent, totals, topExercises] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT s.id)::int AS sessions,
              COALESCE(SUM(w.reps * w.weight), 0)::float AS volume,
              COALESCE(SUM(w.reps), 0)::int AS reps
       FROM workout_sessions s
       LEFT JOIN workout_sets w ON w.session_id = s.id
       WHERE date_trunc('week', s.occurred_on) = date_trunc('week', CURRENT_DATE)`
    ),
    pool.query(
      `SELECT COUNT(DISTINCT s.id)::int AS sessions,
              COALESCE(SUM(w.reps * w.weight), 0)::float AS volume
       FROM workout_sessions s
       LEFT JOIN workout_sets w ON w.session_id = s.id
       WHERE date_trunc('week', s.occurred_on) = date_trunc('week', CURRENT_DATE - INTERVAL '7 days')`
    ),
    pool.query(`${SESSION_SELECT} GROUP BY s.id ORDER BY s.occurred_on DESC, s.id DESC LIMIT 8`),
    pool.query(
      `SELECT COUNT(*)::int AS total_sessions,
              (SELECT COUNT(*)::int FROM exercises WHERE active) AS active_exercises,
              (SELECT COUNT(*)::int FROM workout_sets) AS total_sets
       FROM workout_sessions`
    ),
    pool.query(
      `SELECT e.name, COALESCE(SUM(w.reps * w.weight), 0)::float AS volume, COUNT(*)::int AS sets
       FROM workout_sets w
       JOIN exercises e ON e.id = w.exercise_id
       JOIN workout_sessions s ON s.id = w.session_id
       WHERE date_trunc('week', s.occurred_on) = date_trunc('week', CURRENT_DATE)
       GROUP BY e.name
       ORDER BY volume DESC
       LIMIT 6`
    ),
  ]);

  res.json({
    this_week: thisWeek.rows[0],
    last_week: lastWeek.rows[0],
    totals: totals.rows[0],
    recent: recent.rows,
    top_exercises: topExercises.rows,
  });
}));

module.exports = router;
