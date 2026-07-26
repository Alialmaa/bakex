-- ============================================================
-- Bakex Migration 003 — Objects the code uses but the repo never created
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- ============================================================
--
-- invoices, audit_log and next_invoice_seq() are all referenced by the API but
-- appear in no migration or schema file here. They were presumably created by
-- hand in the dashboard, which leaves two problems:
--
--   * A fresh environment built from this repo is missing them, so the cashier
--     returns 500 on every sale and audit logging writes nothing.
--   * logAudit() deliberately swallows its errors so a logging failure cannot
--     break a request — which also means a missing table is invisible. Every
--     audit entry the app believes it is writing would be silently discarded.
--
-- Everything here is IF NOT EXISTS / CREATE OR REPLACE, so it is safe to run
-- against a database where some of it already exists. Column types are inferred
-- from how the code reads and writes them; adjust if the live table differs.


-- 1. Invoices
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bakery_id          UUID REFERENCES bakeries(id) ON DELETE CASCADE,
  invoice_number     TEXT        NOT NULL,
  customer_name      TEXT,
  items              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_excl_vat  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate           NUMERIC(5,4)  NOT NULL DEFAULT 0,
  vat_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total              NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method     TEXT        NOT NULL DEFAULT 'cash',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IF NOT EXISTS skips only when an index of that NAME exists; it does not skip
-- because the data would violate the constraint. If this table already holds
-- two invoices sharing a number, the statement below aborts the whole
-- migration, so report the conflict instead of failing on it.
DO $$
DECLARE v_dupes INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT bakery_id, invoice_number FROM invoices
    GROUP BY bakery_id, invoice_number HAVING COUNT(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE WARNING 'Skipped unique index: % duplicate invoice numbers exist. Resolve them, then run: CREATE UNIQUE INDEX idx_invoices_number ON invoices (bakery_id, invoice_number);', v_dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices (bakery_id, invoice_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_bakery_date  ON invoices (bakery_id, created_at DESC);


-- 2. Audit log
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bakery_id   UUID REFERENCES bakeries(id) ON DELETE CASCADE,
  actor_id    UUID,
  actor_name  TEXT,
  action      TEXT        NOT NULL,
  target_type TEXT        NOT NULL,
  target_id   TEXT,
  details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_bakery_date ON audit_log (bakery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor       ON audit_log (actor_id);

-- actor_id is intentionally not a foreign key: an entry must survive the
-- deletion of the account that made it, or removing a user erases their trail.


-- 3. Per-day invoice numbering
-- ────────────────────────────────────────────────────────────
-- Returns the next sequence number for a bakery on a given date. The upsert's
-- row lock serialises concurrent tills, so two sales can never be handed the
-- same invoice number.
CREATE TABLE IF NOT EXISTS invoice_seq (
  bakery_id  UUID NOT NULL,
  date_key   TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bakery_id, date_key)
);

CREATE OR REPLACE FUNCTION next_invoice_seq(p_bakery_id UUID, p_date_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO invoice_seq AS s (bakery_id, date_key, last_value)
  VALUES (p_bakery_id, p_date_key, 1)
  ON CONFLICT (bakery_id, date_key) DO UPDATE
    SET last_value = s.last_value + 1
  RETURNING s.last_value INTO v_next;

  RETURN v_next;
END;
$$;


-- 4. Lock everything down, same as migration 001
-- ────────────────────────────────────────────────────────────
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_direct_access" ON invoices;
DROP POLICY IF EXISTS "deny_direct_access" ON audit_log;
DROP POLICY IF EXISTS "deny_direct_access" ON invoice_seq;

CREATE POLICY "deny_direct_access" ON invoices    FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON audit_log   FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON invoice_seq FOR ALL TO anon, authenticated USING (false);

-- Revoke the default PUBLIC grant, then hand EXECUTE back to the role the API
-- actually connects as. The revoke alone is not safe: EXECUTE reaches
-- service_role only through Supabase's default privileges, and if those are not
-- in place the call fails with "permission denied for function" — which would
-- stop the cashier and production outright.
REVOKE ALL ON FUNCTION next_invoice_seq(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_seq(UUID, TEXT) TO service_role;


-- 5. Confirm what this run found
-- ────────────────────────────────────────────────────────────
-- Prints one row per object so you can see whether it already existed.
SELECT 'invoices'          AS object, to_regclass('public.invoices')    IS NOT NULL AS present
UNION ALL SELECT 'audit_log',          to_regclass('public.audit_log')   IS NOT NULL
UNION ALL SELECT 'invoice_seq',        to_regclass('public.invoice_seq') IS NOT NULL
UNION ALL SELECT 'next_invoice_seq()', EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'next_invoice_seq'
);
