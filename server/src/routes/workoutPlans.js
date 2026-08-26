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
  const { rows } = await pool.query(
    `${PLAN_SELECT} GROUP BY p.id ORDER BY p.event_date NULLS FIRST, p.day_of_week NULLS LAST, p.sort_order, p.id`
  );
  res.json(rows);
}));

// day_of_week null and event_date null together mean "rotating cycle" --
// no fixed day, ordered by sort_order and assigned across calendar days by
// lib/workoutGenerate.js. Only weekday/date validate; cycle mode needs
// neither.
function validateDow(dow) {
  return dow === null || (Number.isInteger(dow) && dow >= 0 && dow <= 6);
}

router.post("/", asyncHandler(async (req, res) => {
  const { name, day_of_week = null, event_date = null, active = true } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "A name is required." });

  const dow = event_date ? weekdayOf(event_date) : day_of_week;
  if (!validateDow(dow)) return res.status(400).json({ error: "That's not a valid weekday." });

  try {
    // A cycle plan (no weekday, no date) is ordered by sort_order -- append
    // it to the end of the rotation instead of defaulting everything to 0.
    const sortOrderExpr =
      dow === null && !event_date
        ? `(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM workout_plans WHERE day_of_week IS NULL AND event_date IS NULL)`
        : `0`;
    const { rows } = await pool.query(
      `INSERT INTO workout_plans (name, day_of_week, event_date, active, sort_order)
       VALUES ($1, $2, $3, $4, ${sortOrderExpr}) RETURNING id`,
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

  const { name, active, sort_order } = req.body;
  // event_date and day_of_week can both legitimately be set back to null
  // (switching to a one-off, or into a cycle with no fixed day), so
  // presence in the body decides whether we touch each at all — COALESCE
  // and ?? can't tell "clear it" from "leave it alone".
  const touchingDate = "event_date" in req.body;
  const touchingDow = "day_of_week" in req.body;
  const event_date = touchingDate ? req.body.event_date : before[0].event_date;

  let dow;
  if (event_date) dow = weekdayOf(event_date);
  else if (touchingDow) dow = req.body.day_of_week;
  else dow = before[0].day_of_week;
  if (!validateDow(dow)) return res.status(400).json({ error: "That's not a valid weekday." });

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

module.exports = router;
