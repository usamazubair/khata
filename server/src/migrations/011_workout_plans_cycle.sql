-- Lets a Plan skip both a fixed weekday and a one-off date, becoming part
-- of a rotating cycle (Plan 1 -> Plan 2 -> Plan 3 -> Plan 1...) instead.
-- The existing partial unique index on day_of_week already ignores NULLs,
-- so multiple cycle plans (day_of_week NULL) don't conflict with it.
ALTER TABLE workout_plans ALTER COLUMN day_of_week DROP NOT NULL;
