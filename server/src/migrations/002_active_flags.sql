-- Adds active/inactive toggling to categories, goals, and budgets
-- (fixed_expenses already had it). Non-destructive — safe to run against a
-- database with real data. Run with:
--   psql "$DATABASE_URL" -f src/migrations/002_active_flags.sql

ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
