-- Drops the generic engine in favour of purpose-built modules. Each module is
-- now a hand-built set of pages the server knows about; modules.home_page says
-- which page it opens. Adds the Workout module's tables.
-- Run with: psql "$DATABASE_URL" -f src/migrations/006_modules_rework.sql

DROP TABLE IF EXISTS records CASCADE;
DROP TABLE IF EXISTS fields CASCADE;
DROP TABLE IF EXISTS sections CASCADE;

ALTER TABLE modules DROP COLUMN IF EXISTS kind;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS home_page TEXT;

-- Anything created through the old builder goes; only built-in modules remain.
DELETE FROM modules WHERE slug NOT IN ('khata', 'transactions', 'workout');

UPDATE modules
SET name = 'Transactions',
    slug = 'transactions',
    description = 'Expenses, budgets, goals and fixed bills',
    icon = '📒',
    home_page = 'khata.html',
    sort_order = 1
WHERE slug = 'khata';

INSERT INTO modules (name, slug, description, icon, home_page, sort_order) VALUES
  ('Workout', 'workout', 'Exercises, sessions and sets', '🏋️', 'workout.html', 2)
ON CONFLICT (slug) DO UPDATE
  SET description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      home_page = EXCLUDED.home_page,
      sort_order = EXCLUDED.sort_order;

-- ── Workout module ────────────────────────────────────────────────────────
-- Exercises are the library (managed on the web, like categories); a session
-- is one workout on a date; sets are what you actually logged inside it.

CREATE TABLE IF NOT EXISTS exercises (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL DEFAULT '',
  equipment    TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  sort_order   INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  reps        INT NOT NULL CHECK (reps >= 0),
  weight      NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  set_order   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON workout_sessions (occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_sets_session ON workout_sets (session_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets (exercise_id);

INSERT INTO exercises (name, slug, muscle_group, equipment, sort_order) VALUES
  ('Bench Press',   'bench-press',   'Chest',     'Barbell',   1),
  ('Squat',         'squat',         'Legs',      'Barbell',   2),
  ('Deadlift',      'deadlift',      'Back',      'Barbell',   3),
  ('Overhead Press','overhead-press','Shoulders', 'Barbell',   4),
  ('Pull Up',       'pull-up',       'Back',      'Bodyweight',5),
  ('Bicep Curl',    'bicep-curl',    'Arms',      'Dumbbell',  6)
ON CONFLICT (slug) DO NOTHING;
