-- Khata database schema
-- Run once against a fresh database: psql "$DATABASE_URL" -f src/schema.sql
--
-- Categories are typed (fixed / expense / saved / budget). A transaction can
-- be logged against a category of any type — logging against a "saved"
-- category is a savings contribution, against a "budget" category counts
-- toward that budget's limit, against "fixed" logs a recurring bill, and
-- "expense" is everyday spending. Goals and budgets don't store their own
-- progress — it's always derived by summing transactions in their category.

DROP TABLE IF EXISTS workout_sets CASCADE;
DROP TABLE IF EXISTS workout_sessions CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS module_access CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS fixed_expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ── Accounts and the module registry ──────────────────────────────────────
-- Modules are a fixed, hand-built set (Transactions, Workout). They're
-- enabled or disabled per user, not created at runtime.

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- home_page is the page a module's card opens.
CREATE TABLE modules (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '📦',
  home_page   TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admins implicitly see every module; members see only what's granted here.
CREATE TABLE module_access (
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, module_id)
);

INSERT INTO modules (name, slug, description, icon, home_page, sort_order) VALUES
  ('Transactions', 'transactions', 'Expenses, budgets, goals and fixed bills', '📒', 'khata.html', 1),
  ('Workout',      'workout',      'Exercises, sessions and sets',             '🏋️', 'workout.html', 2),
  ('Timetable',    'timetable',    'Your week, hour by hour',                  '🗓️', NULL,           3),
  ('Todo',         'todo',         'Lists, and everything on them',            '✅', NULL,           4);

-- ── Transactions module tables ──────────────────────────────────────────

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('fixed', 'expense', 'saved', 'budget')),
  color      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE fixed_expenses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  due_day     INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE goals (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  category_id INT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT,
  target_date DATE,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE budgets (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  category_id INT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE transactions (
  id                SERIAL PRIMARY KEY,
  category_id       INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  fixed_expense_id  INT REFERENCES fixed_expenses(id) ON DELETE SET NULL,
  description       TEXT NOT NULL DEFAULT '',
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  is_paid           BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_occurred_on ON transactions (occurred_on DESC);
CREATE INDEX idx_transactions_category ON transactions (category_id);

-- Seed categories across all 4 types (matches the mockup's original names
-- where they map cleanly onto the new taxonomy).
INSERT INTO categories (name, slug, type, color, sort_order) VALUES
  ('Groceries',       'groceries',       'expense', '#2a78d6', 1),
  ('Transport',       'transport',       'expense', '#eb6834', 2),
  ('Family',          'family',          'expense', '#1baf7a', 3),
  ('Health',          'health',          'expense', '#eda100', 4),
  ('Subscriptions',   'subscriptions',   'expense', '#e87ba4', 5),
  ('Other',           'other',           'expense', '#008300', 6),
  ('Internet',        'internet',        'fixed',   '#4a3aa7', 7),
  ('Rent',            'rent',            'fixed',   '#e34948', 8);

-- ── Workout module tables ─────────────────────────────────────────────────
-- Exercises belong to a category (managed on the web, like transaction
-- categories). A workout_plan is a recurring weekly split -- "Monday = Push
-- Day" -- with its own fixed exercise list; a workout_session is one real,
-- dated occurrence, generated from a plan (or created ad hoc), whose
-- exercises you simply tick complete and annotate. workout_sets (reps and
-- weight) still exists for anyone who wants that level of detail, but the
-- session-exercise checklist is the primary, low-friction interaction.

CREATE TABLE exercise_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#2f6bff',
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exercises (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  category_id INT NOT NULL REFERENCES exercise_categories(id) ON DELETE RESTRICT,
  equipment   TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  -- A demo image or short clip; the file lives on Cloudinary, we keep the
  -- delivery URL plus the public_id needed to replace or delete it.
  media_url       TEXT,
  media_public_id TEXT,
  media_type      TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- day_of_week follows Postgres EXTRACT(DOW), same convention as
-- timetable_events: 0 = Sunday ... 6 = Saturday. One plan per weekday.
-- event_date NULL = repeats every week on day_of_week; a date = a one-off
-- that applies only to the week containing it. day_of_week is always set
-- (derived from event_date for one-offs, same convention as
-- timetable_events) so sorting never has to branch on which kind this is.
CREATE TABLE workout_plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  event_date  DATE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a repeating plan (event_date IS NULL) needs to be unique per
-- weekday -- two one-off plans can legitimately share a weekday if they
-- land on different dates.
CREATE UNIQUE INDEX workout_plans_repeating_day_of_week_key
  ON workout_plans (day_of_week) WHERE event_date IS NULL;

CREATE TABLE workout_plan_exercises (
  id          SERIAL PRIMARY KEY,
  plan_id     INT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (plan_id, exercise_id)
);

CREATE TABLE workout_sessions (
  id          SERIAL PRIMARY KEY,
  plan_id     INT REFERENCES workout_plans(id),
  name        TEXT NOT NULL DEFAULT '',
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The completion checklist: one row per exercise in a session, ticked off
-- independently of every other week's occurrence of the same exercise.
CREATE TABLE workout_session_exercises (
  id           SERIAL PRIMARY KEY,
  session_id   INT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id  INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order   INT NOT NULL DEFAULT 0,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes        TEXT NOT NULL DEFAULT '',
  UNIQUE (session_id, exercise_id)
);

CREATE TABLE workout_sets (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  reps        INT NOT NULL CHECK (reps >= 0),
  weight      NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  set_order   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_date ON workout_sessions (occurred_on DESC);
CREATE INDEX idx_sessions_plan ON workout_sessions (plan_id, occurred_on);
CREATE INDEX idx_plan_exercises_plan ON workout_plan_exercises (plan_id, sort_order);
CREATE INDEX idx_session_exercises_session ON workout_session_exercises (session_id, sort_order);
CREATE INDEX idx_sets_session ON workout_sets (session_id);
CREATE INDEX idx_sets_exercise ON workout_sets (exercise_id);

INSERT INTO exercise_categories (name, slug, color, sort_order) VALUES
  ('Chest',     'chest',     '#2f6bff', 1),
  ('Legs',      'legs',      '#f4661f', 2),
  ('Back',      'back',      '#00b37e', 3),
  ('Shoulders', 'shoulders', '#f0a500', 4),
  ('Arms',      'arms',      '#e0459c', 5);

INSERT INTO exercises (name, slug, category_id, equipment, sort_order)
SELECT 'Bench Press', 'bench-press', id, 'Barbell', 1 FROM exercise_categories WHERE slug = 'chest'
UNION ALL
SELECT 'Squat', 'squat', id, 'Barbell', 2 FROM exercise_categories WHERE slug = 'legs'
UNION ALL
SELECT 'Deadlift', 'deadlift', id, 'Barbell', 3 FROM exercise_categories WHERE slug = 'back'
UNION ALL
SELECT 'Overhead Press', 'overhead-press', id, 'Barbell', 4 FROM exercise_categories WHERE slug = 'shoulders'
UNION ALL
SELECT 'Pull Up', 'pull-up', id, 'Bodyweight', 5 FROM exercise_categories WHERE slug = 'back'
UNION ALL
SELECT 'Bicep Curl', 'bicep-curl', id, 'Dumbbell', 6 FROM exercise_categories WHERE slug = 'arms';

-- ── Timetable module tables ─────────────────────────────────────────────
-- One row is one entry on the grid. event_date decides which kind it is:
-- NULL means it repeats every week on day_of_week (a class, a standing
-- meeting, gym); a date means it happens once. day_of_week is stored either
-- way -- derived from the date for one-offs -- so the week view can select on
-- a single column instead of branching.
--
-- day_of_week follows Postgres EXTRACT(DOW): 0 = Sunday ... 6 = Saturday.

CREATE TABLE timetable_events (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  notes          TEXT NOT NULL DEFAULT '',
  location       TEXT NOT NULL DEFAULT '',
  color          TEXT NOT NULL DEFAULT '#2f6bff',
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  event_date     DATE,
  starts_at      TIME NOT NULL,
  ends_at        TIME NOT NULL,
  remind_minutes INT CHECK (remind_minutes IS NULL OR remind_minutes >= 0),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timetable_ends_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX idx_timetable_day ON timetable_events (day_of_week, starts_at);
CREATE INDEX idx_timetable_date ON timetable_events (event_date) WHERE event_date IS NOT NULL;

-- ── Todo module tables ──────────────────────────────────────────────────
-- A list is the card you pick first (Car, Home, Groceries); items live on it.

CREATE TABLE todo_lists (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  icon       TEXT NOT NULL DEFAULT '🗂️',
  color      TEXT NOT NULL DEFAULT '#2f6bff',
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE todo_items (
  id         SERIAL PRIMARY KEY,
  list_id    INT NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  due_date   DATE,
  -- 0 none, 1 medium, 2 high. Kept numeric so ORDER BY sorts it directly.
  priority   SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 2),
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  done_at    TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_items_list ON todo_items (list_id, done, sort_order);
CREATE INDEX idx_todo_items_due ON todo_items (due_date) WHERE due_date IS NOT NULL AND NOT done;

INSERT INTO todo_lists (name, slug, icon, color, sort_order) VALUES
  ('Home',      'home',      '🏠', '#2f6bff', 1),
  ('Car',       'car',       '🚗', '#f4661f', 2),
  ('Groceries', 'groceries', '🛒', '#00b37e', 3);
