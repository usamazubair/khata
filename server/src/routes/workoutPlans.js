const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

const PLAN_SELECT = `
  SELECT p.id, p.name, p.day_of_week, p.event_date, p.active, p.sort_order,
         COALESCE(
           json_agg(
             json_build_object(
               'id', pe.id, 'exercise_id', e.id, 'name', e.name,
               'category_name', ec.name, 'category_color', ec.color,
               'sort_order', pe.sort_order
             ) ORDER BY pe.sort_order, e.name
           ) FILTER (WHERE pe.id IS NOT NULL),
           '[]'
         ) AS exercises
  FROM workout_plans p
  LEFT JOIN workout_plan_exercises pe ON pe.plan_id = p.id
  LEFT JOIN exercises e ON e.id = pe.exercise_id
  LEFT JOIN exercise_categories ec ON ec.id = e.category_id
`;

/** A one-off's weekday is implied by its date, so it's derived rather than
 *  trusted from the client — same rule as the Timetable module. */
function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${PLAN_SELECT} GROUP BY p.id ORDER BY p.event_date NULLS FIRST, p.day_of_week`);
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, day_of_week, event_date = null, active = true } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "A name is required." });

  const dow = event_date ? weekdayOf(event_date) : day_of_week;
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
    return res.status(400).json({ error: "Pick a weekday, or a date for a one-off." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_plans (name, day_of_week, event_date, active) VALUES ($1, $2, $3, $4) RETURNING id`,
      [String(name).trim(), dow, event_date, active]
    );
    const { rows: full } = await pool.query(`${PLAN_SELECT} WHERE p.id = $1 GROUP BY p.id`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That weekday already has a repeating plan." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { rows: before } = await pool.query("SELECT * FROM workout_plans WHERE id = $1", [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Plan not found." });

  const { name, day_of_week, active, sort_order } = req.body;
  // event_date can legitimately be set to null (switching a one-off back to
  // repeating), so presence in the body decides whether we touch it at all —
  // COALESCE can't tell "clear it" from "leave it alone".
  const touchingDate = "event_date" in req.body;
  const event_date = touchingDate ? req.body.event_date : before[0].event_date;
  const dow = event_date ? weekdayOf(event_date) : (day_of_week ?? before[0].day_of_week);

  try {
    const { rows } = await pool.query(
      `UPDATE workout_plans SET
         name = COALESCE($1, name),
         day_of_week = $2,
         event_date = $3,
         active = COALESCE($4, active),
         sort_order = COALESCE($5, sort_order)
       WHERE id = $6 RETURNING id`,
      [name, dow, event_date, active, sort_order, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Plan not found." });
    const { rows: full } = await pool.query(`${PLAN_SELECT} WHERE p.id = $1 GROUP BY p.id`, [rows[0].id]);
    res.json(full[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That weekday already has a repeating plan." });
    throw err;
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM workout_plans WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Plan not found." });
    res.status(204).end();
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This plan has generated sessions — deactivate it instead of deleting." });
    }
    throw err;
  }
}));

// Replaces the plan's whole exercise list in one call -- simplest way for a
// reorderable add/remove/reorder editor to save: send the exercises in the
// order they should appear, and that's the new list.
router.put("/:id/exercises", asyncHandler(async (req, res) => {
  const { exercise_ids } = req.body;
  if (!Array.isArray(exercise_ids)) return res.status(400).json({ error: "exercise_ids must be an array." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query("SELECT 1 FROM workout_plans WHERE id = $1", [req.params.id]);
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Plan not found." });
    }
    await client.query("DELETE FROM workout_plan_exercises WHERE plan_id = $1", [req.params.id]);
    for (let i = 0; i < exercise_ids.length; i++) {
      await client.query(
        "INSERT INTO workout_plan_exercises (plan_id, exercise_id, sort_order) VALUES ($1, $2, $3)",
        [req.params.id, exercise_ids[i], i]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23503") return res.status(400).json({ error: "One of those exercises doesn't exist." });
    throw err;
  } finally {
    client.release();
  }

  const { rows: full } = await pool.query(`${PLAN_SELECT} WHERE p.id = $1 GROUP BY p.id`, [req.params.id]);
  res.json(full[0]);
}));

// Turns this week's active plans into real, dated sessions -- the same
// "template becomes an instance" relationship Fixed Bills already have to
// their monthly transactions. Safe to call repeatedly: a plan that already
// has a session for its day this week is left alone, not duplicated. A
// one-off plan (event_date set) only ever matches the single week
// containing that date, so it naturally never fires again afterward --
// nothing needs to deactivate it.
router.post("/generate", asyncHandler(async (req, res) => {
  const weekStart = req.body.week_start;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: "week_start (YYYY-MM-DD, a Monday) is required." });
  }
  const weekEnd = (() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
  })();

  const { rows: plans } = await pool.query("SELECT * FROM workout_plans WHERE active");

  for (const plan of plans) {
    let targetDate;
    if (plan.event_date) {
      const iso = plan.event_date.toISOString ? plan.event_date.toISOString().slice(0, 10) : plan.event_date;
      if (iso < weekStart || iso > weekEnd) continue; // this one-off isn't in the requested week
      targetDate = iso;
    } else {
      // Postgres day_of_week: 0 Sun..6 Sat. week_start is a Monday, so the
      // offset from it is 0 for Monday, up to 6 for the following Sunday.
      const offset = (plan.day_of_week + 6) % 7;
      const d = new Date(`${weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      targetDate = d.toISOString().slice(0, 10);
    }

    const { rows: existing } = await pool.query(
      "SELECT id FROM workout_sessions WHERE plan_id = $1 AND occurred_on = $2::date",
      [plan.id, targetDate]
    );
    if (existing.length) continue;

    const { rows: created } = await pool.query(
      `INSERT INTO workout_sessions (plan_id, name, occurred_on) VALUES ($1, $2, $3::date) RETURNING id`,
      [plan.id, plan.name, targetDate]
    );
    await pool.query(
      `INSERT INTO workout_session_exercises (session_id, exercise_id, sort_order)
       SELECT $1, exercise_id, sort_order FROM workout_plan_exercises WHERE plan_id = $2`,
      [created[0].id, plan.id]
    );
  }

  const { rows: week } = await pool.query(
    `SELECT s.id, s.plan_id, s.name, s.occurred_on,
            COUNT(se.id)::int AS total_exercises,
            COUNT(se.id) FILTER (WHERE se.completed)::int AS completed_exercises
     FROM workout_sessions s
     LEFT JOIN workout_session_exercises se ON se.session_id = s.id
     WHERE s.occurred_on BETWEEN $1::date AND $2::date
     GROUP BY s.id ORDER BY s.occurred_on`,
    [weekStart, weekEnd]
  );
  res.json(week);
}));

module.exports = router;
