-- ============================================================
-- Bakex Migration 005 — Subscription payments (Moyasar webhook)
-- Apply in: Supabase Dashboard → SQL Editor
--
-- Run the numbered steps in order, ONE AT A TIME. Pasting the whole file into
-- the web editor at once is what truncated it the first time; each step below
-- is small enough that a partial paste fails visibly instead of half-applying.
-- ============================================================
--
-- Until now a subscription could only be activated by a super admin clicking
-- "activate" after seeing a bank transfer. This adds the machinery for the
-- gateway to do it: a ledger of payments received, and one function that
-- records a payment and extends the subscription in a single transaction.
--
-- Why a function rather than the two writes in JS:
--
--   * Replay. A gateway retries a webhook until it gets a 2xx, and an attacker
--     can replay one deliberately. `ON CONFLICT DO NOTHING` on the payment id
--     is what makes a second delivery a no-op — checked in SQL, where the
--     uniqueness is actually enforced. A SELECT-then-INSERT in JS loses that
--     race and grants two years for one payment.
--   * Atomicity. Recording the payment and extending the subscription must
--     both happen or neither: a crash between them either takes money without
--     access, or grants access with no record of why.


-- ─── STEP 1 — the payment ledger ────────────────────────────
-- One row per payment the gateway told us about and we verified. This is the
-- answer to "why is this bakery active until 2027?".
CREATE TABLE IF NOT EXISTS subscription_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bakery_id           UUID REFERENCES bakeries(id) ON DELETE CASCADE,
  provider            TEXT        NOT NULL DEFAULT 'moyasar',
  -- The gateway's own id for the payment. Uniqueness per provider is the
  -- replay guard; nothing else here is trusted for that.
  provider_payment_id TEXT        NOT NULL,
  amount_halalas      INTEGER     NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'SAR',
  days_granted        INTEGER     NOT NULL DEFAULT 0,
  granted_until       TIMESTAMPTZ,
  applied_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_provider_id
  ON subscription_payments (provider, provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_bakery
  ON subscription_payments (bakery_id, created_at DESC);


-- ─── STEP 2 — lock the table down ───────────────────────────
-- Same posture as 001: the API connects as service_role, which bypasses RLS.
-- Nobody holding the anon key gets to read what customers paid.
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_direct_access" ON subscription_payments;
CREATE POLICY "deny_direct_access" ON subscription_payments
  FOR ALL TO anon, authenticated USING (false);


-- ─── STEP 3 — apply_subscription_payment ────────────────────
-- Records the payment and extends the subscription, once.
--
-- Returns JSONB:
--   { "applied": true,  "duplicate": false, "ends_at": "..." }  first delivery
--   { "applied": false, "duplicate": true,  "ends_at": "..." }  replay — no-op
--   { "applied": false, "duplicate": false, "reason": "unknown_bakery" }
--
-- The extension runs from the later of now() and the current end date, so a
-- customer who renews early keeps the days they already paid for instead of
-- having them overwritten.
CREATE OR REPLACE FUNCTION apply_subscription_payment(
  p_provider       TEXT,
  p_payment_id     TEXT,
  p_bakery_id      UUID,
  p_amount_halalas INTEGER,
  p_currency       TEXT,
  p_days           INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
  v_ends TIMESTAMPTZ;
BEGIN
  IF p_days <= 0 OR p_days > 3660 THEN
    RAISE EXCEPTION 'p_days out of range: %', p_days;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bakeries WHERE id = p_bakery_id) THEN
    RETURN jsonb_build_object('applied', false, 'duplicate', false, 'reason', 'unknown_bakery');
  END IF;

  -- The claim. If another delivery of the same payment is in flight this
  -- blocks until it commits, then inserts nothing — which is the point.
  INSERT INTO subscription_payments (
    bakery_id, provider, provider_payment_id, amount_halalas, currency, days_granted
  ) VALUES (
    p_bakery_id, p_provider, p_payment_id, p_amount_halalas, p_currency, p_days
  )
  ON CONFLICT (provider, provider_payment_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT subscription_ends_at INTO v_ends FROM bakeries WHERE id = p_bakery_id;
    RETURN jsonb_build_object('applied', false, 'duplicate', true, 'ends_at', v_ends);
  END IF;

  UPDATE bakeries
     SET subscription_status  = 'active',
         subscription_ends_at = GREATEST(COALESCE(subscription_ends_at, now()), now())
                                + (p_days || ' days')::interval
   WHERE id = p_bakery_id
   RETURNING subscription_ends_at INTO v_ends;

  UPDATE subscription_payments
     SET applied_at = now(), granted_until = v_ends
   WHERE provider = p_provider AND provider_payment_id = p_payment_id;

  RETURN jsonb_build_object('applied', true, 'duplicate', false, 'ends_at', v_ends);
END;
$$;


-- ─── STEP 4 — grants ────────────────────────────────────────
-- Without the GRANT the API's own call fails with "permission denied for
-- function", because REVOKE strips the default PUBLIC execute right.
REVOKE ALL ON FUNCTION apply_subscription_payment(TEXT, TEXT, UUID, INTEGER, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_subscription_payment(TEXT, TEXT, UUID, INTEGER, TEXT, INTEGER)
  TO service_role;


-- ─── STEP 5 — verify ────────────────────────────────────────
-- Expect one row, with `true`.
SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE')
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'apply_subscription_payment';
