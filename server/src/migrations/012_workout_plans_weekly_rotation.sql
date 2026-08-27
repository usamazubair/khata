-- Lets several repeating plans share the same weekday, forming a rotation
-- (Monday = Week 1's plan, then Week 2's, then Week 3's, then back to
-- Week 1's...) instead of only ever allowing exactly one. A single plan on
-- a weekday still behaves exactly as before -- rotating through a group of
-- one is a no-op -- so this is purely additive.
DROP INDEX IF EXISTS workout_plans_repeating_day_of_week_key;
