const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { generateWorkoutWeek, mondayOf } = require("../lib/workoutGenerate");

const router = express.Router();

const SESSION_SELECT = `
  SELECT s.*,
         COUNT(se.id)::int AS total_exercises,
         COUNT(se.id) FILTER (WHERE se.completed)::int AS completed_exercises
  FROM workout_sessions s
  LEFT JOIN workout_session_exercises se ON se.session_id = s.id
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

// One session plus its exercise checklist, in order.
router.get("/sessions/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE s.id = $1 GROUP BY s.id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Session not found." });

  const { rows: exercises } = await pool.query(
    `SELECT se.*, e.name AS exercise_name, e.media_url, e.media_type,
            ec.name AS category_name, ec.color AS category_color
     FROM workout_session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     JOIN exercise_categories ec ON ec.id = e.category_id
     WHERE se.session_id = $1
     ORDER BY se.sort_order, se.id`,
    [req.params.id]
  );
  res.json({ ...rows[0], exercises });
}));

router.post("/sessions", asyncHandler(async (req, res) => {
  const { name = "", occurred_on, notes = "" } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO workout_sessions (name, occurred_on, notes)
     VALUES ($1, COALESCE($2, CURRENT_DATE), $3) RETURNING *`,
    [name, occurred_on || null, notes]
  );
  res.status(201).json({ ...rows[0], total_exercises: 0, completed_exercises: 0, exercises: [] });
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

/* ── session exercise checklist ───────────────────────────────────────────
   Adding/removing which exercises belong to a session is a web-only action
   (mobile only ticks completion and writes notes) -- same split as every
   other "definition vs. day-to-day" pair in this app. */

router.post("/sessions/:id/exercises", asyncHandler(async (req, res) => {
  const { exercise_id } = req.body;
  if (!exercise_id) return res.status(400).json({ error: "exercise_id is required." });

  const { rows: session } = await pool.query("SELECT 1 FROM workout_sessions WHERE id = $1", [req.params.id]);
  if (!session.length) return res.status(404).json({ error: "Session not found." });

  const { rows: last } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM workout_session_exercises WHERE session_id = $1",
    [req.params.id]
  );
  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_session_exercises (session_id, exercise_id, sort_order)
       VALUES ($1, $2, $3) RETURNING id`,
      [req.params.id, exercise_id, last[0].next]
    );
    const { rows: full } = await pool.query(
      `SELECT se.*, e.name AS exercise_name, e.media_url, e.media_type,
              ec.name AS category_name, ec.color AS category_color
       FROM workout_session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
       JOIN exercise_categories ec ON ec.id = e.category_id
       WHERE se.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That exercise is already on this session." });
    if (err.code === "23503") return res.status(400).json({ error: "That exercise doesn't exist." });
    throw err;
  }
}));

// Toggling completion and writing notes is the one everyday interaction,
// available on both web and mobile.
router.put("/session-exercises/:id", asyncHandler(async (req, res) => {
  const { completed, notes } = req.body;
  const touchingCompleted = typeof completed === "boolean";
  const { rows } = await pool.query(
    `UPDATE workout_session_exercises SET
       completed = COALESCE($1, completed),
       -- completed_at only moves when completed actually flips, so editing
       -- notes later doesn't rewrite when it was finished.
       completed_at = CASE WHEN $2::boolean AND $1 IS DISTINCT FROM completed
                           THEN (CASE WHEN $1 THEN now() ELSE NULL END)
                           ELSE completed_at END,
       notes = COALESCE($3, notes)
     WHERE id = $4 RETURNING *`,
    [completed, touchingCompleted, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found." });
  res.json(rows[0]);
}));

router.delete("/session-exercises/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM workout_session_exercises WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Not found." });
  res.status(204).end();
}));

/* ── legacy sets (reps/weight) ─────────────────────────────────────────────
   No longer surfaced by any UI -- the exercise checklist above replaced it
   as the primary interaction -- but left in place so nothing already logged
   is destroyed, and so the data is still reachable if it's ever wanted. */

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
    res.status(201).json(rows[0]);
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
  res.json(rows[0]);
}));

router.delete("/sets/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM workout_sets WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Set not found." });
  res.status(204).end();
}));

/* ── overview ──────────────────────────────────────────────────────────── */

// Weeks run Monday-to-Sunday, which is what date_trunc('week') gives us.
// This week's active plans are generated into real sessions right here --
// there's no separate "generate" step for anyone to remember to click.
router.get("/summary", asyncHandler(async (req, res) => {
  await generateWorkoutWeek(mondayOf(new Date()));

  const [thisWeek, recent, totals] = await Promise.all([
    pool.query(
      `SELECT s.id, s.plan_id, s.name, s.occurred_on,
              COUNT(se.id)::int AS total_exercises,
              COUNT(se.id) FILTER (WHERE se.completed)::int AS completed_exercises
       FROM workout_sessions s
       LEFT JOIN workout_session_exercises se ON se.session_id = s.id
       WHERE date_trunc('week', s.occurred_on) = date_trunc('week', CURRENT_DATE)
       GROUP BY s.id ORDER BY s.occurred_on`
    ),
    pool.query(`${SESSION_SELECT} GROUP BY s.id ORDER BY s.occurred_on DESC, s.id DESC LIMIT 8`),
    pool.query(
      `SELECT COUNT(*)::int AS total_sessions,
              (SELECT COUNT(*)::int FROM exercises WHERE active) AS active_exercises,
              (SELECT COUNT(*)::int FROM workout_plans WHERE active) AS active_plans
       FROM workout_sessions`
    ),
  ]);

  res.json({
    this_week: thisWeek.rows,
    recent: recent.rows,
    totals: totals.rows[0],
  });
}));

module.exports = router;
