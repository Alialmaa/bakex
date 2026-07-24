-- ============================================================
-- Bakex Security Migration 001
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Token version column — enables instant session invalidation
--    When an admin changes a user's role/status, token_version is
--    incremented in the DB. Any existing JWT with the old version
--    is rejected within 30 seconds.
-- ────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;


-- 2. Row Level Security — blocks anyone using the public anon key
--    directly against the Supabase REST/PostgREST API.
--    The service role key used by the Next.js API routes bypasses
--    RLS entirely, so the app is unaffected.
-- ────────────────────────────────────────────────────────────

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bakeries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies before adding restrictive ones
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('users','bakeries','stock','recipes',
                               'sales','purchases','production_log','invoices')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Deny ALL direct access from anon and authenticated Supabase users.
-- Service role bypasses these policies — the app works normally.
CREATE POLICY "deny_direct_access" ON users          FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON bakeries       FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON stock          FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON recipes        FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON sales          FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON purchases      FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON production_log FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON invoices       FOR ALL TO anon, authenticated USING (false);


-- 3. Indexes — keep high-traffic queries fast as data grows
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_bakery          ON users          (bakery_id);
CREATE INDEX IF NOT EXISTS idx_users_username        ON users          (username);
CREATE INDEX IF NOT EXISTS idx_stock_bakery          ON stock          (bakery_id);
CREATE INDEX IF NOT EXISTS idx_recipes_bakery        ON recipes        (bakery_id);
CREATE INDEX IF NOT EXISTS idx_sales_bakery_date     ON sales          (bakery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_bakery_date ON purchases      (bakery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_bakery     ON production_log (bakery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_bakery_date  ON invoices       (bakery_id, created_at DESC);
