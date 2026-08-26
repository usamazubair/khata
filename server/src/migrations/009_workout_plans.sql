-- Adds exercise categories and a weekly recurring plan-per-weekday, whose
-- exercise list gets copied into real dated sessions on demand -- the same
-- relationship Fixed Bills already have to their monthly transactions.
-- Also adds the session-exercise completion checklist that replaces
-- reps/weight logging as the primary interaction. workout_sets is left
-- untouched -- existing logged history isn't destroyed, it's just no
-- longer what the UI is built around.
-- Run with: psql "$DATABASE_URL" -f src/migrations/009_workout_plans.sql

CREATE TABLE IF NOT EXISTS exercise_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#2f6bff',
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill: every distinct existing muscle_group becomes a real category, so
-- nothing already-created loses its grouping. Case-insensitive de-duped.
INSERT INTO exercise_categories (name, slug, sort_order)
SELECT DISTINCT ON (lower(btrim(muscle_group)))
       btrim(muscle_group),
       lower(regexp_replace(btrim(muscle_group), '[^a-zA-Z0-9]+', '-', 'g')),
       0
FROM exercises
WHERE muscle_group IS NOT NULL AND btrim(muscle_group) != ''
ORDER BY lower(btrim(muscle_group))
ON CONFLICT (name) DO NOTHING;

-- A catch-all for any exercise that had no muscle_group at all, so
-- category_id can be made NOT NULL below.
INSERT INTO exercise_categories (name, slug)
VALUES ('Other', 'other')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category_id INT REFERENCES exercise_categories(id);

UPDATE exercises e
SET category_id = ec.id
FROM exercise_categories ec
WHERE e.category_id IS NULL
  AND lower(ec.name) = lower(NULLIF(btrim(e.muscle_group), ''));

UPDATE exercises e
SET category_id = (SELECT id FROM exercise_categories WHERE slug = 'other')
WHERE e.category_id IS NULL;

ALTER TABLE exercises ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE exercises DROP COLUMN IF EXISTS muscle_group;

-- ── Weekly recurring plans ──────────────────────────────────────────────
-- day_of_week follows Postgres EXTRACT(DOW), same convention as
-- timetable_events: 0 = Sunday ... 6 = Saturday. One plan per weekday.
CREATE TABLE IF NOT EXISTS workout_plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_plan_exercises (
  id          SERIAL PRIMARY KEY,
  plan_id     INT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (plan_id, exercise_id)
);

ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES workout_plans(id);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
  id           SERIAL PRIMARY KEY,
  session_id   INT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id  INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order   INT NOT NULL DEFAULT 0,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes        TEXT NOT NULL DEFAULT '',
  UNIQUE (session_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_plan ON workout_sessions (plan_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan ON workout_plan_exercises (plan_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON workout_session_exercises (session_id, sort_order);
