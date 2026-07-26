-- ============================================================
-- Bakex Migration 002 — Rate limiting + atomic stock movements
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- 1. Shared rate-limit counters
-- ────────────────────────────────────────────────────────────
-- lib/rateLimit.ts counted attempts in a per-process Map. On Vercel each
-- request may land on a different serverless instance, so the counter reset
-- constantly and the limit never actually applied — an attacker could send
-- thousands of password guesses in parallel. Moving the counter into Postgres
-- makes it shared across every instance.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  hits         INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_direct_access" ON rate_limits;
CREATE POLICY "deny_direct_access" ON rate_limits
  FOR ALL TO anon, authenticated USING (false);

-- Atomic increment. INSERT ... ON CONFLICT DO UPDATE takes a row lock, so two
-- concurrent requests for the same key can never both read the same stale count
-- and each write back the same value.
CREATE OR REPLACE FUNCTION rate_limit_hit(
  p_key        TEXT,
  p_window_sec INTEGER,
  p_max        INTEGER
)
RETURNS TABLE (allowed BOOLEAN, hits INTEGER, retry_after_sec INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hits   INTEGER;
  v_start  TIMESTAMPTZ;
  v_cutoff TIMESTAMPTZ := now() - make_interval(secs => p_window_sec);
BEGIN
  INSERT INTO rate_limits AS r (key, hits, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET hits         = CASE WHEN r.window_start < v_cutoff THEN 1     ELSE r.hits + 1 END,
        window_start = CASE WHEN r.window_start < v_cutoff THEN now() ELSE r.window_start END
  RETURNING r.hits, r.window_start INTO v_hits, v_start;

  -- Opportunistic cleanup (~1% of calls) so the table cannot grow forever.
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '1 day';
  END IF;

  RETURN QUERY SELECT
    v_hits <= p_max,
    v_hits,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM
      (v_start + make_interval(secs => p_window_sec)) - now()
    )))::INTEGER;
END;
$$;


-- 2. Atomic production
-- ────────────────────────────────────────────────────────────
-- The produce endpoint checked every ingredient, then deducted in a second
-- pass. Two requests arriving together both passed the check and both
-- deducted, so a bakery could produce twice the goods from one set of
-- materials. Doing it in one function puts the whole sequence in a single
-- transaction, and the row locks taken by UPDATE serialise concurrent callers.

CREATE OR REPLACE FUNCTION produce_recipe(
  p_bakery_id UUID,
  p_recipe_id UUID,
  p_batches   INTEGER,
  p_user_id   UUID
)
RETURNS TABLE (total_units NUMERIC, shortage TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_recipe    RECORD;
  v_ing       JSONB;
  v_material  TEXT;
  v_amount    NUMERIC;
  v_needed    NUMERIC;
  v_units     NUMERIC;
  v_updated   INTEGER;
BEGIN
  IF p_batches IS NULL OR p_batches < 1 THEN
    RETURN QUERY SELECT 0::NUMERIC, 'invalid_batches'::TEXT; RETURN;
  END IF;

  SELECT * INTO v_recipe FROM recipes
   WHERE id = p_recipe_id AND bakery_id = p_bakery_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'recipe_not_found'::TEXT; RETURN;
  END IF;

  -- Deduct each ingredient with the quantity guard in the WHERE clause, so the
  -- check and the write are one statement and cannot interleave.
  FOR v_ing IN SELECT * FROM jsonb_array_elements(COALESCE(v_recipe.ingredients, '[]'::jsonb))
  LOOP
    v_material := v_ing ->> 'material';
    BEGIN
      v_amount := (v_ing ->> 'amount')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_ingredient_amount';
    END;

    IF v_material IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'invalid_ingredient';
    END IF;

    v_needed := v_amount * p_batches;

    UPDATE stock SET qty = qty - v_needed
     WHERE bakery_id = p_bakery_id AND name = v_material AND qty >= v_needed;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      -- Raising rolls back every deduction already made in this call.
      RAISE EXCEPTION 'insufficient:%', v_material;
    END IF;
  END LOOP;

  v_units := COALESCE(NULLIF(v_recipe.units_per_batch, 0), NULLIF(v_recipe.output_qty, 0), 1) * p_batches;

  INSERT INTO production_log (recipe_id, recipe_name, output_qty, output_unit, produced_by, bakery_id)
  VALUES (p_recipe_id, v_recipe.name, v_units, v_recipe.output_unit, p_user_id, p_bakery_id);

  -- Add the finished goods, creating the row on first production.
  INSERT INTO stock (bakery_id, name, qty, unit)
  VALUES (p_bakery_id, v_recipe.name, v_units, COALESCE(v_recipe.output_unit, 'حبة'))
  ON CONFLICT (bakery_id, name) DO UPDATE SET qty = stock.qty + EXCLUDED.qty;

  RETURN QUERY SELECT v_units, NULL::TEXT;
END;
$$;

-- produce_recipe's upsert needs a key to conflict on. A bakery should not have
-- two stock rows with the same name anyway — getStockByName() calls .single()
-- and would error if it did.
--
-- IF NOT EXISTS skips only when an index of that NAME exists, not when the data
-- would violate the constraint, so duplicates would abort this whole migration.
-- Report them instead and leave the rest of the migration applied.
DO $$
DECLARE v_dupes INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT bakery_id, name FROM stock
    GROUP BY bakery_id, name HAVING COUNT(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE WARNING 'Skipped unique index: % duplicate (bakery_id, name) stock rows exist. produce_recipe cannot run until they are merged. See the query in the migration notes.', v_dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_bakery_name ON stock (bakery_id, name);
  END IF;
END $$;


-- 3. Atomic stock adjustment (purchases)
-- ────────────────────────────────────────────────────────────
-- adjustStockQty read the quantity and wrote back qty + delta. Two purchases
-- recorded at once both read the old value, and one increment was lost.

CREATE OR REPLACE FUNCTION adjust_stock_qty(
  p_bakery_id UUID,
  p_name      TEXT,
  p_delta     NUMERIC,
  p_new_price NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE stock
     SET qty = GREATEST(0, qty + p_delta),
         price_per_unit = COALESCE(p_new_price, price_per_unit)
   WHERE bakery_id = p_bakery_id AND name = p_name;
$$;


-- 4. Lock the helpers down
-- ────────────────────────────────────────────────────────────
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Only the role
-- the API connects as should be able to call these.
--
-- The grant back to service_role is not optional: revoking PUBLIC leaves
-- EXECUTE reaching service_role only via Supabase's default privileges, and if
-- those are absent every call fails with "permission denied for function" —
-- which for produce_recipe means production stops entirely.
REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION produce_recipe(UUID, UUID, INTEGER, UUID)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION adjust_stock_qty(UUID, TEXT, NUMERIC, NUMERIC)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER)         TO service_role;
GRANT EXECUTE ON FUNCTION produce_recipe(UUID, UUID, INTEGER, UUID)      TO service_role;
GRANT EXECUTE ON FUNCTION adjust_stock_qty(UUID, TEXT, NUMERIC, NUMERIC) TO service_role;


-- 5. Report the result
-- ────────────────────────────────────────────────────────────
-- `stock_unique_index` false means duplicates blocked it; merge them and create
-- the index by hand, because produce_recipe's upsert needs it:
--
--   -- inspect first
--   SELECT bakery_id, name, COUNT(*), SUM(qty)
--     FROM stock GROUP BY bakery_id, name HAVING COUNT(*) > 1;
--
--   -- then, per group: keep the oldest row with the summed quantity and the
--   -- highest unit price, and delete the rest
--   WITH ranked AS (
--     SELECT id, bakery_id, name, qty, price_per_unit,
--            ROW_NUMBER() OVER (PARTITION BY bakery_id, name ORDER BY created_at NULLS LAST, id) AS rn,
--            SUM(qty)          OVER (PARTITION BY bakery_id, name) AS total_qty,
--            MAX(price_per_unit) OVER (PARTITION BY bakery_id, name) AS best_price
--       FROM stock
--   )
--   UPDATE stock s SET qty = r.total_qty, price_per_unit = r.best_price
--     FROM ranked r WHERE s.id = r.id AND r.rn = 1;
--   DELETE FROM stock WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

SELECT 'rate_limits table'   AS object, to_regclass('public.rate_limits') IS NOT NULL AS ok
UNION ALL SELECT 'rate_limit_hit()',    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rate_limit_hit')
UNION ALL SELECT 'produce_recipe()',    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'produce_recipe')
UNION ALL SELECT 'adjust_stock_qty()',  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adjust_stock_qty')
UNION ALL SELECT 'stock_unique_index',  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stock_bakery_name');
