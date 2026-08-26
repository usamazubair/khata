-- Lets a workout plan be a one-off on a specific calendar date, not just a
-- weekly repeat -- the same choice timetable_events already offers. A plan
-- with event_date set applies to exactly the week containing that date;
-- day_of_week is derived from it (same convention as timetable_events) so
-- sorting and display don't need to branch on which kind a plan is.
-- Run with: psql "$DATABASE_URL" -f src/migrations/010_workout_plans_one_off.sql

ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS event_date DATE;

-- The old blanket "one plan per weekday" no longer holds once one-offs
-- exist -- two one-off plans can share a weekday if they land on different
-- dates. Only repeating plans (event_date IS NULL) still need to be unique
-- per weekday.
ALTER TABLE workout_plans DROP CONSTRAINT IF EXISTS workout_plans_day_of_week_key;
CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_repeating_day_of_week_key
  ON workout_plans (day_of_week) WHERE event_date IS NULL;
