-- ============================================================
-- Bakex Migration 004 — Push reporting aggregation into Postgres
-- Apply in: Supabase Dashboard → SQL Editor
--
-- Run the steps ONE AT A TIME.
-- ============================================================
--
-- The dashboard and reports pages each pulled every sale, purchase and
-- production row for the period and summed them in JavaScript. listProduction()
-- had no date filter at all, so both pages fetched the entire production
-- history, and the reports page re-ran the whole set every 30 seconds for every
-- open tab. A bakery with 50k sales a month was transferring all 50k rows per
-- page view to produce a handful of totals.
--
-- These functions return the totals directly. Only the row-heavy summing moves;
-- unit cost and margin still come from recipes and stock in the application,
-- because those tables are small and the calculation is business logic worth
-- keeping in one readable place.
--
-- Every function is scoped by bakery_id, matching the tenant isolation the
-- application enforces. Each is STABLE so Postgres may reuse results within a
-- statement, and none of them writes.


-- ─── STEP 1 — supporting indexes ────────────────────────────
-- Migration 001 added (bakery_id, created_at DESC) for sales, purchases and
-- production_log, which already serves these range scans. This one helps the
-- per-recipe grouping below.
CREATE INDEX IF NOT EXISTS idx_sales_bakery_recipe ON sales (bakery_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_production_bakery_recipe ON production_log (bakery_id, recipe_id);


-- ─── STEP 2 — sales totals for a period ─────────────────────
-- Replaces fetching every row to sum `total` in JS.
CREATE OR REPLACE FUNCTION sales_revenue(
  p_bakery_id UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $srv$
  SELECT COALESCE(SUM(total), 0)
    FROM sales
   WHERE bakery_id = p_bakery_id
     AND created_at >= p_from
     AND (p_to IS NULL OR created_at <= p_to);
$srv$;


-- ─── STEP 3 — sales grouped per recipe ──────────────────────
-- Feeds the product breakdown table. recipe_id is nullable on sales, so rows
-- without one are grouped under NULL rather than dropped.
CREATE OR REPLACE FUNCTION sales_by_recipe(
  p_bakery_id UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (recipe_id UUID, qty NUMERIC, revenue NUMERIC)
LANGUAGE SQL
STABLE
AS $sbr$
  SELECT s.recipe_id,
         COALESCE(SUM(s.qty), 0)   AS qty,
         COALESCE(SUM(s.total), 0) AS revenue
    FROM sales s
   WHERE s.bakery_id = p_bakery_id
     AND s.created_at >= p_from
     AND (p_to IS NULL OR s.created_at <= p_to)
   GROUP BY s.recipe_id;
$sbr$;


-- ─── STEP 4 — daily sales totals ────────────────────────────
-- Feeds the weekly chart. generate_series fills in days with no sales, which
-- the JS version handled by building the 7-day skeleton itself.
--
-- Days are cut in UTC. The JS version grouped on
-- created_at.split('T')[0] — the UTC date — and every date bound the app sends
-- comes from toISOString(), so UTC is what the rest of the app already means by
-- "today". Comparing a timestamptz against a bare DATE would instead use the
-- session's timezone and silently shift each day's figures by three hours in
-- Riyadh, changing numbers users have already seen.
CREATE OR REPLACE FUNCTION sales_daily_totals(
  p_bakery_id UUID,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (day DATE, total NUMERIC)
LANGUAGE SQL
STABLE
AS $sdt$
  SELECT d.day::DATE,
         COALESCE(SUM(s.total), 0) AS total
    -- Cast explicitly: generate_series has both timestamp and timestamptz
    -- overloads, and passing a bare DATE leaves the choice ambiguous.
    FROM generate_series(p_from::TIMESTAMP, p_to::TIMESTAMP, INTERVAL '1 day') AS d(day)
    LEFT JOIN sales s
           ON s.bakery_id = p_bakery_id
          AND (s.created_at AT TIME ZONE 'UTC')::DATE = d.day::DATE
   GROUP BY d.day
   ORDER BY d.day;
$sdt$;


-- ─── STEP 5 — purchase cost for a period ────────────────────
-- Replaces fetching qty and price_per_unit for every purchase row to multiply
-- and sum them in JS.
CREATE OR REPLACE FUNCTION purchase_cost(
  p_bakery_id UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $pc$
  SELECT COALESCE(SUM(qty * price_per_unit), 0)
    FROM purchases
   WHERE bakery_id = p_bakery_id
     AND created_at >= p_from
     AND (p_to IS NULL OR created_at <= p_to);
$pc$;


-- ─── STEP 6 — production grouped per recipe ─────────────────
-- Replaces pulling the entire production_log — which had no date filter — and
-- grouping it in JS.
CREATE OR REPLACE FUNCTION production_by_recipe(
  p_bakery_id UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (recipe_id UUID, recipe_name TEXT, output_unit TEXT, total NUMERIC)
LANGUAGE SQL
STABLE
AS $pbr$
  SELECT p.recipe_id,
         MAX(p.recipe_name) AS recipe_name,
         MAX(p.output_unit) AS output_unit,
         COALESCE(SUM(p.output_qty), 0) AS total
    FROM production_log p
   WHERE p.bakery_id = p_bakery_id
     AND p.created_at >= p_from
     AND (p_to IS NULL OR p.created_at <= p_to)
   GROUP BY p.recipe_id;
$pbr$;


-- ─── STEP 7 — low stock count ───────────────────────────────
-- The dashboard pulled every stock row to count those below their minimum and
-- to build the alert list. The list still needs rows, but the count does not.
CREATE OR REPLACE FUNCTION low_stock_count(p_bakery_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $lsc$
  SELECT COUNT(*)::INTEGER
    FROM stock
   WHERE bakery_id = p_bakery_id
     AND min_qty > 0
     AND qty < min_qty;
$lsc$;


-- ─── STEP 7b — low stock items ──────────────────────────────
-- The alert list needs rows, not just a count. PostgREST cannot express a
-- column-to-column comparison (qty < min_qty), so without this the application
-- had to fetch a slice of the table and filter it in JS.
CREATE OR REPLACE FUNCTION low_stock_items(p_bakery_id UUID, p_limit INTEGER DEFAULT 4)
RETURNS TABLE (name TEXT, qty NUMERIC, unit TEXT, min_qty NUMERIC)
LANGUAGE SQL
STABLE
AS $lsi$
  SELECT s.name, s.qty, s.unit, s.min_qty
    FROM stock s
   WHERE s.bakery_id = p_bakery_id
     AND s.min_qty > 0
     AND s.qty < s.min_qty
   ORDER BY s.qty ASC
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$lsi$;


-- ─── STEP 8 — permissions ───────────────────────────────────
-- Same reasoning as migrations 002 and 003: revoking PUBLIC leaves EXECUTE
-- reaching service_role only through Supabase's defaults, so grant it back.
REVOKE ALL ON FUNCTION sales_revenue(UUID, TIMESTAMPTZ, TIMESTAMPTZ)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sales_by_recipe(UUID, TIMESTAMPTZ, TIMESTAMPTZ)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sales_daily_totals(UUID, DATE, DATE)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION purchase_cost(UUID, TIMESTAMPTZ, TIMESTAMPTZ)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION production_by_recipe(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION low_stock_count(UUID)                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION low_stock_items(UUID, INTEGER)                       FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION sales_revenue(UUID, TIMESTAMPTZ, TIMESTAMPTZ)        TO service_role;
GRANT EXECUTE ON FUNCTION sales_by_recipe(UUID, TIMESTAMPTZ, TIMESTAMPTZ)      TO service_role;
GRANT EXECUTE ON FUNCTION sales_daily_totals(UUID, DATE, DATE)                 TO service_role;
GRANT EXECUTE ON FUNCTION purchase_cost(UUID, TIMESTAMPTZ, TIMESTAMPTZ)        TO service_role;
GRANT EXECUTE ON FUNCTION production_by_recipe(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION low_stock_count(UUID)                                TO service_role;
GRANT EXECUTE ON FUNCTION low_stock_items(UUID, INTEGER)                       TO service_role;


-- ─── STEP 9 — report ────────────────────────────────────────
SELECT p.proname AS function, true AS created
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('sales_revenue','sales_by_recipe','sales_daily_totals',
                     'purchase_cost','production_by_recipe','low_stock_count','low_stock_items')
 ORDER BY p.proname;
