-- Two new hand-built modules: Timetable and Todo.
-- Run with: psql "$DATABASE_URL" -f src/migrations/008_timetable_and_todo.sql

INSERT INTO modules (name, slug, description, icon, home_page, sort_order) VALUES
  ('Timetable', 'timetable', 'Your week, hour by hour', '🗓️', NULL, 3),
  ('Todo',      'todo',      'Lists, and everything on them', '✅', NULL, 4)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order;

-- ── Timetable ─────────────────────────────────────────────────────────────
-- One row is one entry on the grid. event_date decides which kind it is:
-- NULL means it repeats every week on day_of_week (a class, a standing
-- meeting, gym); a date means it happens once. day_of_week is stored either
-- way -- derived from the date for one-offs -- so the week view can select on
-- a single column instead of branching.
--
-- day_of_week follows Postgres EXTRACT(DOW): 0 = Sunday ... 6 = Saturday.
CREATE TABLE IF NOT EXISTS timetable_events (
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

CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_events (day_of_week, starts_at);
CREATE INDEX IF NOT EXISTS idx_timetable_date ON timetable_events (event_date) WHERE event_date IS NOT NULL;

-- ── Todo ──────────────────────────────────────────────────────────────────
-- A list is the card you pick first (Car, Home, Groceries); items live on it.
CREATE TABLE IF NOT EXISTS todo_lists (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  icon       TEXT NOT NULL DEFAULT '🗂️',
  color      TEXT NOT NULL DEFAULT '#2f6bff',
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todo_items (
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

CREATE INDEX IF NOT EXISTS idx_todo_items_list ON todo_items (list_id, done, sort_order);
CREATE INDEX IF NOT EXISTS idx_todo_items_due ON todo_items (due_date) WHERE due_date IS NOT NULL AND NOT done;

INSERT INTO todo_lists (name, slug, icon, color, sort_order) VALUES
  ('Home',      'home',      '🏠', '#2f6bff', 1),
  ('Car',       'car',       '🚗', '#f4661f', 2),
  ('Groceries', 'groceries', '🛒', '#00b37e', 3)
ON CONFLICT (slug) DO NOTHING;
