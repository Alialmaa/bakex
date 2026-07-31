-- ============================================================
-- Bakex Migration 006 — Cut days where the bakery is, not in UTC
-- Apply in: Supabase Dashboard → SQL Editor
--
-- Run the numbered steps in order, ONE AT A TIME. Pasting the whole file into
-- the web editor at once is what truncated it the first time; each step below
-- is small enough that a partial paste fails visibly instead of half-applying.
-- ============================================================
--
-- 004 bucketed sales by their UTC date, and the app derived every calendar date
-- from toISOString(), so the two agreed. They agreed on the wrong answer:
-- Riyadh is UTC+3, so from midnight to 3am local the UTC date is still
-- yesterday's. A bakery working nights had every sale in those three hours
-- filed under the previous day — on the chart, in "مبيعات اليوم", and on the
-- invoice number.
--
-- lib/businessDay.ts now shifts the JS side by a fixed +03:00 (Saudi Arabia has
-- never observed daylight saving, so the offset is exact all year). This step
-- moves the SQL side with it. Apply it BEFORE deploying the code, or the chart
-- will bucket in UTC while the totals above it are bounded in Riyadh time, and
-- the first and last bars will disagree with the card.
--
-- Nothing is rewritten: created_at stays a timestamptz recording the true
-- instant. Only the bucketing changes.


-- ─── STEP 1 — sales_daily_totals, bucketed in Riyadh ────────
-- CREATE OR REPLACE keeps the existing grants, so this needs no REVOKE/GRANT
-- pair of its own — the signature is unchanged. Step 2 re-issues the grant
-- anyway, because it is idempotent and cheap next to a route failing with
-- "permission denied for function" in production.
--
-- p_from and p_to are business dates. The window they select runs from the
-- start of p_from in Riyadh to the start of the day after p_to in Riyadh, which
-- is three hours earlier in UTC than it used to be at both ends.
CREATE OR REPLACE FUNCTION sales_daily_totals(
  p_bakery_id UUID,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (day DATE, total NUMERIC)
LANGUAGE SQL
STABLE
AS $sdt$
  -- The range predicate still compares created_at directly so the
  -- (bakery_id, created_at) index stays usable. Wrapping the indexed column in
  -- a timezone conversion here would force a scan of every sale the bakery has
  -- ever made; the conversion belongs in the bucketing, over the far smaller
  -- set of rows the range already selected.
  WITH totals AS (
    SELECT (s.created_at AT TIME ZONE 'Asia/Riyadh')::DATE AS bucket,
           SUM(s.total) AS total
      FROM sales s
     WHERE s.bakery_id = p_bakery_id
       AND s.created_at >= (p_from::TIMESTAMP)      AT TIME ZONE 'Asia/Riyadh'
       AND s.created_at <  ((p_to + 1)::TIMESTAMP)  AT TIME ZONE 'Asia/Riyadh'
     GROUP BY 1
  )
  SELECT g.day::DATE,
         COALESCE(t.total, 0)
    FROM generate_series(p_from::TIMESTAMP, p_to::TIMESTAMP, INTERVAL '1 day') AS g(day)
    LEFT JOIN totals t ON t.bucket = g.day::DATE
   ORDER BY g.day;
$sdt$;


-- ─── STEP 2 — grants ────────────────────────────────────────
REVOKE ALL   ON FUNCTION sales_daily_totals(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sales_daily_totals(UUID, DATE, DATE) TO service_role;


-- ─── STEP 3 — verify ────────────────────────────────────────
-- Expect one row, with `true`.
SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE')
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'sales_daily_totals';

-- And a sanity check on a real bakery: any sale rung up between midnight and
-- 3am Riyadh should now appear on the day it was rung up, not the one before.
-- Replace the UUID before running.
--
-- SELECT created_at,
--        (created_at AT TIME ZONE 'Asia/Riyadh')::DATE AS business_day,
--        (created_at AT TIME ZONE 'UTC')::DATE         AS old_utc_day,
--        total
--   FROM sales
--  WHERE bakery_id = '00000000-0000-0000-0000-000000000000'
--    AND (created_at AT TIME ZONE 'Asia/Riyadh')::DATE
--        <> (created_at AT TIME ZONE 'UTC')::DATE
--  ORDER BY created_at DESC
--  LIMIT 20;
