-- Phase 1 of the "personal cupboard" restructure: real user accounts and a
-- module registry. Khata becomes module #1 rather than being the whole app.
-- Non-destructive — safe to run against a database with real data. Run with:
--   psql "$DATABASE_URL" -f src/migrations/003_auth_and_modules.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- kind='system' modules are hand-built pages (Khata). kind='generic' ones are
-- defined from the dashboard and rendered from their stored schema (phase 2).
CREATE TABLE IF NOT EXISTS modules (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '📦',
  kind        TEXT NOT NULL DEFAULT 'generic' CHECK (kind IN ('system', 'generic')),
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admins implicitly see every module; members see only what's granted here.
CREATE TABLE IF NOT EXISTS module_access (
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, module_id)
);

INSERT INTO modules (name, slug, description, icon, kind, sort_order) VALUES
  ('Khata', 'khata', 'Expenses, budgets, goals and fixed bills', '📒', 'system', 1)
ON CONFLICT (slug) DO NOTHING;
