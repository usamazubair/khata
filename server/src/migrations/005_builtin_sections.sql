-- Khata's navigation was hardcoded in the frontend, so it couldn't be renamed,
-- reordered or hidden the way a generic module's can. This turns its pages into
-- real section rows: a section with a page_key renders that built-in page
-- instead of the generic table, but is otherwise editable like any other.
-- Non-destructive; safe against a database with real data. Run with:
--   psql "$DATABASE_URL" -f src/migrations/005_builtin_sections.sql

ALTER TABLE sections ADD COLUMN IF NOT EXISTS page_key TEXT;

INSERT INTO sections (module_id, name, slug, icon, page_key, sort_order)
SELECT m.id, v.name, v.slug, v.icon, v.page_key, v.sort_order
FROM modules m
CROSS JOIN (VALUES
  ('Overview',           'overview',    '📊', 'khata.html',         1),
  ('Transactions',       'transactions','📝', 'transactions.html',  2),
  ('Categories',         'categories',  '🏷️', 'categories.html',    3),
  ('Fixed Transactions', 'fixed',       '📅', 'fixed.html',         4),
  ('Goals',              'goals',       '🎯', 'goals.html',         5),
  ('Budgets',            'budgets',     '💰', 'budgets.html',       6)
) AS v(name, slug, icon, page_key, sort_order)
WHERE m.slug = 'khata'
ON CONFLICT (module_id, slug) DO NOTHING;
