const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

const COLUMNS = `id, title, notes, location, color, day_of_week, event_date,
                 to_char(starts_at, 'HH24:MI') AS starts_at,
                 to_char(ends_at,   'HH24:MI') AS ends_at,
                 remind_minutes, active`;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A one-off's weekday is implied by its date, so we derive it rather than
 *  trusting the client to keep the two in step. */
function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function validate({ title, starts_at, ends_at, day_of_week, event_date }) {
  if (!title || !String(title).trim()) return "A title is required.";
  if (!HHMM.test(starts_at ?? "") || !HHMM.test(ends_at ?? "")) return "Times must look like 09:30.";
  if (ends_at <= starts_at) return "The end time has to be after the start time.";
  if (!event_date && !(Number.isInteger(day_of_week) && day_of_week >= 0 && day_of_week <= 6)) {
    return "Pick a weekday, or a date for a one-off.";
  }
  return null;
}

// The whole timetable. `?active=true` gives only what should reach the phone.
router.get("/", asyncHandler(async (req, res) => {
  const { active, q } = req.query;
  const clauses = [];
  const params = [];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`active = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(title ILIKE $${params.length} OR location ILIKE $${params.length} OR notes ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM timetable_events
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY day_of_week, starts_at, title`,
    params
  );
  res.json(rows);
}));

/** Every occurrence between two dates, with repeats already expanded — the
 *  shape the phone's agenda and its reminders both want, so neither has to
 *  re-implement the recurrence rule. */
router.get("/occurrences", asyncHandler(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60);

  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM timetable_events WHERE active ORDER BY starts_at, title`
  );

  const [y, m, d] = from.split("-").map(Number);
  const out = [];
  for (let i = 0; i < days; i++) {
    // Built in UTC so the day never shifts under the server's timezone.
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const iso = day.toISOString().slice(0, 10);
    const dow = day.getUTCDay();
    for (const e of rows) {
      const matches = e.event_date ? e.event_date === iso : e.day_of_week === dow;
      if (matches) out.push({ ...e, date: iso, event_date: e.event_date ? iso : null });
    }
  }
  out.sort((a, b) => (a.date === b.date ? a.starts_at.localeCompare(b.starts_at) : a.date.localeCompare(b.date)));
  res.json(out);
}));

router.post("/", asyncHandler(async (req, res) => {
  const {
    title, notes = "", location = "", color = "#2f6bff",
    day_of_week, event_date = null, starts_at, ends_at,
    remind_minutes = null, active = true,
  } = req.body;

  const dow = event_date ? weekdayOf(event_date) : day_of_week;
  const error = validate({ title, starts_at, ends_at, day_of_week: dow, event_date });
  if (error) return res.status(400).json({ error });

  const { rows } = await pool.query(
    `INSERT INTO timetable_events
       (title, notes, location, color, day_of_week, event_date, starts_at, ends_at, remind_minutes, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${COLUMNS}`,
    [String(title).trim(), notes, location, color, dow, event_date, starts_at, ends_at, remind_minutes, active]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { rows: before } = await pool.query(`SELECT ${COLUMNS} FROM timetable_events WHERE id = $1`, [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Event not found." });

  const {
    title, notes, location, color, day_of_week, starts_at, ends_at, remind_minutes, active,
  } = req.body;

  // event_date and remind_minutes are legitimately null, so COALESCE can't
  // tell "clear this" from "leave it alone" — presence in the body decides.
  const clearingDate = "event_date" in req.body;
  const event_date = clearingDate ? req.body.event_date : before[0].event_date;
  const dow = event_date ? weekdayOf(event_date) : (day_of_week ?? before[0].day_of_week);

  const merged = {
    title: title ?? before[0].title,
    starts_at: starts_at ?? before[0].starts_at,
    ends_at: ends_at ?? before[0].ends_at,
    day_of_week: dow,
    event_date,
  };
  const error = validate(merged);
  if (error) return res.status(400).json({ error });

  const touchingRemind = "remind_minutes" in req.body;
  const { rows } = await pool.query(
    `UPDATE timetable_events SET
       title = COALESCE($1, title),
       notes = COALESCE($2, notes),
       location = COALESCE($3, location),
       color = COALESCE($4, color),
       day_of_week = $5,
       event_date = $6,
       starts_at = COALESCE($7, starts_at),
       ends_at = COALESCE($8, ends_at),
       remind_minutes = CASE WHEN $9::boolean THEN $10 ELSE remind_minutes END,
       active = COALESCE($11, active)
     WHERE id = $12 RETURNING ${COLUMNS}`,
    [title, notes, location, color, dow, event_date, starts_at, ends_at,
     touchingRemind, remind_minutes ?? null, active, req.params.id]
  );
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM timetable_events WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Event not found." });
  res.status(204).end();
}));

module.exports = router;
