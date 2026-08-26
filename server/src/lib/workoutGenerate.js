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
  const scheduledPlans = plans.filter((p) => p.day_of_week !== null || p.event_date);

  for (const plan of scheduledPlans) {
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
