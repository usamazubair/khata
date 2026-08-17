-- Khata database schema
-- Run once against a fresh database: psql "$DATABASE_URL" -f src/schema.sql
--
-- Categories are typed (fixed / expense / saved / budget). A transaction can
-- be logged against a category of any type — logging against a "saved"
-- category is a savings contribution, against a "budget" category counts
-- toward that budget's limit, against "fixed" logs a recurring bill, and
-- "expense" is everyday spending. Goals and budgets don't store their own
-- progress — it's always derived by summing transactions in their category.

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS fixed_expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

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
