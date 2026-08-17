-- Phase 2: the generic engine. A module gets sections (its navigation pages),
-- each section defines fields (the shape of its table and form), and records
-- hold the actual rows as JSONB — no runtime CREATE TABLE, so adding a module
-- never touches the database structure.
-- Non-destructive; safe against a database with real data. Run with:
--   psql "$DATABASE_URL" -f src/migrations/004_sections_fields_records.sql

CREATE TABLE IF NOT EXISTS sections (
  id         SERIAL PRIMARY KEY,
  module_id  INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📄',
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);

-- options holds the type's extra config:
--   select   -> {"choices": ["Low", "Medium", "High"]}
--   relation -> {"section_id": 7}
CREATE TABLE IF NOT EXISTS fields (
  id          SERIAL PRIMARY KEY,
  section_id  INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN
                ('text', 'longtext', 'number', 'money', 'date', 'boolean', 'select', 'color', 'relation')),
  required    BOOLEAN NOT NULL DEFAULT FALSE,
  options     JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, key)
);

CREATE TABLE IF NOT EXISTS records (
  id         SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_module ON sections (module_id);
CREATE INDEX IF NOT EXISTS idx_fields_section ON fields (section_id);
CREATE INDEX IF NOT EXISTS idx_records_section ON records (section_id);
CREATE INDEX IF NOT EXISTS idx_records_data ON records USING GIN (data);
