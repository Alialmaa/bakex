-- ============================================================
-- Bakex Migration 003 — Objects the code uses but the repo never created
-- Apply in: Supabase Dashboard → SQL Editor
--
-- Run the numbered steps in order, ONE AT A TIME. Pasting the whole file into
-- the web editor at once is what truncated it the first time; each step below
-- is small enough that a partial paste fails visibly instead of half-applying.
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
-- Every step is IF NOT EXISTS / CREATE OR REPLACE, so re-running is harmless.
-- Column types are inferred from how the code reads and writes them; adjust if
-- the live table differs.


-- ─── STEP 1 — invoices ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bakery_id          UUID REFERENCES bakeries(id) ON DELETE CASCADE,
  invoice_number     TEXT          NOT NULL,
  customer_name      TEXT,
  items              JSONB         NOT NULL DEFAULT '[]'::jsonb,
  subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_excl_vat  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate           NUMERIC(5,4)  NOT NULL DEFAULT 0,
  vat_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total              NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method     TEXT          NOT NULL DEFAULT 'cash',
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_bakery_date ON invoices (bakery_id, created_at DESC);


-- ─── STEP 2 — audit_log ─────────────────────────────────────
-- actor_id is deliberately not a foreign key: an entry must outlive the account
-- that made it, or deleting a user erases their trail.
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


-- ─── STEP 3 — per-day invoice numbering ─────────────────────
-- The upsert's row lock serialises concurrent tills, so two sales can never be
-- handed the same invoice number.
CREATE TABLE IF NOT EXISTS invoice_seq (
  bakery_id  UUID    NOT NULL,
  date_key   TEXT    NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bakery_id, date_key)
);

CREATE OR REPLACE FUNCTION next_invoice_seq(p_bakery_id UUID, p_date_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $fn$
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
$fn$;


-- ─── STEP 4 — lock down, same as migration 001 ──────────────
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_direct_access" ON invoices;
DROP POLICY IF EXISTS "deny_direct_access" ON audit_log;
DROP POLICY IF EXISTS "deny_direct_access" ON invoice_seq;

CREATE POLICY "deny_direct_access" ON invoices    FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON audit_log   FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_direct_access" ON invoice_seq FOR ALL TO anon, authenticated USING (false);

-- Revoking the default PUBLIC grant leaves EXECUTE reaching service_role — the
-- role the API connects as — only through Supabase's default privileges. Where
-- those are absent the call fails with "permission denied for function", which
-- would stop the cashier outright, so grant it back explicitly.
REVOKE ALL   ON FUNCTION next_invoice_seq(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION next_invoice_seq(UUID, TEXT) TO service_role;


-- ─── STEP 5 — report what exists now ────────────────────────
SELECT 'invoices'           AS object, to_regclass('public.invoices')    IS NOT NULL AS present
UNION ALL SELECT 'audit_log',           to_regclass('public.audit_log')   IS NOT NULL
UNION ALL SELECT 'invoice_seq',         to_regclass('public.invoice_seq') IS NOT NULL
UNION ALL SELECT 'next_invoice_seq()',  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'next_invoice_seq');


-- ─── STEP 6 — duplicate invoice numbers (check, then act) ───
-- Run this on its own. It should return no rows.
--
--   SELECT bakery_id, invoice_number, COUNT(*)
--     FROM invoices GROUP BY bakery_id, invoice_number HAVING COUNT(*) > 1;
--
-- If it returns nothing, add the constraint:
--
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number
--     ON invoices (bakery_id, invoice_number);
--
-- If it returns rows, two sales share a number — resolve those before adding
-- the index, and tell me what it returned.


-- ─── STEP 7 — seed the counter from existing invoices ───────
-- Only relevant if this database already holds invoices.
--
-- next_invoice_seq() was replaced, not created, on any database where it already
-- existed. If the previous implementation counted from somewhere other than
-- invoice_seq, that table starts empty and today's numbering restarts at 0001 —
-- colliding with invoices already issued today.
--
-- Diagnose first:
--
--   SELECT (SELECT COUNT(*) FROM invoices)     AS invoice_rows,
--          (SELECT COUNT(*) FROM invoice_seq)  AS seq_rows,
--          (SELECT MAX(invoice_number) FROM invoices) AS highest_number,
--          (SELECT COUNT(*) FROM audit_log)    AS audit_rows,
--          (SELECT MIN(created_at) FROM audit_log) AS oldest_audit;
--
-- invoice_rows > 0 while seq_rows = 0 means the counter must be seeded before
-- the next sale. The date_key comes out of invoice_number rather than
-- created_at, so it matches exactly what the app generated regardless of the
-- session's timezone.
--
--   INSERT INTO invoice_seq (bakery_id, date_key, last_value)
--   SELECT bakery_id,
--          substring(invoice_number from 'INV-(\d{8})-')      AS date_key,
--          MAX((substring(invoice_number from '-(\d+)$'))::int) AS last_value
--     FROM invoices
--    WHERE bakery_id IS NOT NULL
--      AND invoice_number ~ '^INV-\d{8}-\d+$'
--    GROUP BY bakery_id, substring(invoice_number from 'INV-(\d{8})-')
--   ON CONFLICT (bakery_id, date_key) DO UPDATE
--     SET last_value = GREATEST(invoice_seq.last_value, EXCLUDED.last_value);
--
-- Then confirm the next number continues rather than repeats:
--
--   SELECT bakery_id, date_key, last_value FROM invoice_seq ORDER BY date_key DESC;
