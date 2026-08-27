const { pool } = require("../db");

/** The Monday of the week `date` falls in, as YYYY-MM-DD. */
function mondayOf(date) {
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset));
  return d.toISOString().slice(0, 10);
}

async function createSessionIfMissing(plan, targetDate) {
  const { rows: existing } = await pool.query(
    "SELECT id FROM workout_sessions WHERE plan_id = $1 AND occurred_on = $2::date",
    [plan.id, targetDate]
  );
  if (existing.length) return;

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

const MS_PER_DAY = 86400000;
// 1970-01-05 was a Monday -- an epoch that itself lands on a Monday, so
// weekIndexOf() flips from one integer to the next exactly on the Monday
// boundary. That's what keeps every weekday in the same rotation group
// (Monday, Thursday, ...) landing on the same "week N of the rotation"
// as each other, rather than drifting mid-week.
const WEEK_EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);

function weekIndexOf(mondayIso) {
  const [y, m, d] = mondayIso.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - WEEK_EPOCH_MONDAY_MS) / (7 * MS_PER_DAY));
}

/** Turns this week's active plans into real, dated sessions -- the same
 *  "template becomes an instance" relationship Fixed Bills have to their
 *  monthly transactions. Safe to call repeatedly: a plan that already has a
 *  session for its day this week is left alone, not duplicated. A one-off
 *  plan (event_date set) only ever matches the single week containing that
 *  date, so it naturally never fires again afterward. Called automatically
 *  whenever the workout summary loads, so nothing has to trigger it by hand. */
async function generateWorkoutWeek(weekStart) {
  const weekEnd = (() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
  })();

  const { rows: plans } = await pool.query("SELECT * FROM workout_plans WHERE active ORDER BY sort_order, id");

  // A cycle plan has neither a fixed weekday nor a one-off date -- it's part
  // of a rotation (Plan 1 -> Plan 2 -> Plan 3 -> Plan 1...) that assigns one
  // plan per calendar day, every day, continuing seamlessly across weeks.
  const cyclePlans = plans.filter((p) => p.day_of_week === null && !p.event_date);
  const oneOffPlans = plans.filter((p) => p.event_date);
  // Plans that share a weekday form that weekday's own rotation (Monday's
  // 1st plan this week, 2nd next week, ... back to the 1st) -- a weekday
  // with only one plan is a rotation of one, so "always the same plan"
  // (the original, simpler mode) needs no special-casing here at all.
  const repeatingByWeekday = new Map();
  for (const p of plans) {
    if (p.day_of_week === null || p.event_date) continue;
    if (!repeatingByWeekday.has(p.day_of_week)) repeatingByWeekday.set(p.day_of_week, []);
    repeatingByWeekday.get(p.day_of_week).push(p);
  }

  for (const plan of oneOffPlans) {
    const iso = plan.event_date.toISOString ? plan.event_date.toISOString().slice(0, 10) : plan.event_date;
    if (iso < weekStart || iso > weekEnd) continue; // this one-off isn't in the requested week
    await createSessionIfMissing(plan, iso);
  }

  const weekIndex = weekIndexOf(weekStart);
  for (const [dow, group] of repeatingByWeekday) {
    // Postgres day_of_week: 0 Sun..6 Sat. week_start is a Monday, so the
    // offset from it is 0 for Monday, up to 6 for the following Sunday.
    const offset = (dow + 6) % 7;
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    const targetDate = d.toISOString().slice(0, 10);

    // Once this weekday already has a session from *any* plan in its
    // rotation, that slot is filled -- reordering the rotation (or the
    // group's membership changing) only changes future weeks, it never
    // reassigns a week that's already been generated.
    const groupIds = group.map((p) => p.id);
    const { rows: filled } = await pool.query(
      "SELECT 1 FROM workout_sessions WHERE plan_id = ANY($1::int[]) AND occurred_on = $2::date",
      [groupIds, targetDate]
    );
    if (filled.length) continue;

    const plan = group[weekIndex % group.length];
    await createSessionIfMissing(plan, targetDate);
  }

  if (cyclePlans.length > 0) {
    const cyclePlanIds = cyclePlans.map((p) => p.id);
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const targetDate = d.toISOString().slice(0, 10);

      // Once a day already has a session from *any* plan in the rotation,
      // its slot is considered filled -- reordering the cycle later only
      // changes which plan gets picked for days that don't have one yet,
      // it never reassigns a day that was already generated.
      const { rows: filled } = await pool.query(
        "SELECT 1 FROM workout_sessions WHERE plan_id = ANY($1::int[]) AND occurred_on = $2::date",
        [cyclePlanIds, targetDate]
      );
      if (filled.length) continue;

      // The absolute day count (not the week or weekday) picks the plan, so
      // the rotation carries on unbroken from one week into the next.
      const dayIndex = Math.floor(d.getTime() / MS_PER_DAY);
      const plan = cyclePlans[dayIndex % cyclePlans.length];
      await createSessionIfMissing(plan, targetDate);
    }
  }
}

module.exports = { generateWorkoutWeek, mondayOf };
