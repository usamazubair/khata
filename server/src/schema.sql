-- Khata database schema
-- Run once against a fresh database: psql "$DATABASE_URL" -f src/schema.sql

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('need', 'want', 'fixed')),
  color      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  due_day     INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS transactions (
  id                SERIAL PRIMARY KEY,
  category_id       INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  fixed_expense_id  INT REFERENCES fixed_expenses(id) ON DELETE SET NULL,
  description       TEXT NOT NULL DEFAULT '',
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  is_paid           BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON transactions (occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id           SERIAL PRIMARY KEY,
  category_id  INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  month        DATE NOT NULL, -- first day of the month, e.g. 2026-08-01
  limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount >= 0),
  UNIQUE (category_id, month)
);

CREATE TABLE IF NOT EXISTS goals (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount >= 0),
  saved_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_date   DATE
);

-- Seed categories (matches the approved mockup; safe to re-run)
INSERT INTO categories (name, type, color, sort_order) VALUES
  ('Bills',         'need', '#2a78d6', 1),
  ('Groceries',     'need', '#eb6834', 2),
  ('Transport',     'need', '#1baf7a', 3),
  ('Family',        'need', '#eda100', 4),
  ('Health',        'need', '#e87ba4', 5),
  ('Loan',          'fixed','#008300', 6),
  ('Subscriptions', 'want', '#4a3aa7', 7),
  ('Other',         'want', '#e34948', 8)
ON CONFLICT (name) DO NOTHING;
