# Bakex — operating notes

Bakery inventory + cashier SaaS. Next.js (pages router) on Vercel, Supabase
(Postgres) for data, JWT auth in an httpOnly cookie. Multi-tenant: every row is
scoped by `bakery_id`.

## Deploying

Vercel builds from `main`. Feature work happens on a branch and merges via PR.

**Environment variables** (Vercel → Settings → Environment Variables), all for
Production **and** Preview:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key; bypasses RLS. Never sent to the browser. |
| `JWT_SECRET` | Signs the auth cookie. The app refuses to boot without it. |
| `RESEND_API_KEY` | Transactional email (verification, password reset). |
| `APP_URL` | Origin used to build email links, e.g. `https://bakexsystem.com`. **Must be set** — see security note below. |

Optional, read by `lib/payment.ts` and shown on `/billing`. Each is safe to leave
unset — the page degrades to the next payment method rather than breaking:

| Variable | Purpose |
|---|---|
| `PAYMENT_LINK_URL` | Hosted payment link. **https only**; anything else is ignored and the card button disappears. |
| `BANK_NAME`, `BANK_IBAN`, `BANK_ACCOUNT_NAME` | Bank transfer details. Shown only when **all three** are set — partial details cannot be paid into. |
| `SUPPORT_WHATSAPP` | Support number. Non-digits are stripped, so a pasted `+966 55 …` works. |

The subscription is a single charge once a year, so this deliberately has no
recurring billing, no stored cards and no webhooks. A payment link is enough
until manual activation becomes the bottleneck.

Changing an env var needs a redeploy to take effect; Vercel does not rebuild
automatically.

## Database migrations

Applied by hand in Supabase → SQL Editor, in order. Run each **one step at a
time** — pasting a whole file into the web editor has truncated it mid-token.
All four are applied to the current production database.

| File | What it adds |
|---|---|
| `001_security.sql` | `token_version`, RLS deny-all policies, base indexes |
| `002_rate_limit_and_atomicity.sql` | `rate_limits` table, `rate_limit_hit`, `produce_recipe`, `adjust_stock_qty`, the `(bakery_id, name)` unique index on stock |
| `003_missing_objects.sql` | `invoices`, `audit_log`, `invoice_seq`, `next_invoice_seq` — objects the code assumed but no migration created |
| `004_reporting_aggregates.sql` | `sales_revenue`, `sales_by_recipe`, `sales_daily_totals`, `purchase_cost`, `production_by_recipe`, `low_stock_count`, `low_stock_items` |

**Any new SQL function needs `GRANT EXECUTE ... TO service_role`** after its
`REVOKE`. The API connects as `service_role`; without the grant the call fails
with "permission denied for function". Verify with:

```sql
SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE')
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = '<fn>';
```

The code depends on the functions in 002 and 004, so **apply migrations before
deploying** code that calls them.

## Security invariants — do not regress these

- **Pages use `requirePage()`, API routes use `requireAuth()`/`requirePerm()`.**
  Never `getUser()` alone for access control — it only checks the JWT signature,
  not `token_version`, account status, or subscription. `getServerSideProps`
  embeds fetched rows in the HTML, so an unverified session there leaks data.
- **Role and permissions come from the database, not the token.** `resolveSession`
  re-reads them so a demotion takes effect within ~30s. Do not read `role`/`perms`
  off the raw JWT for authorization.
- **Money is computed server-side.** Invoice and sale totals are derived from
  line items; never trust a client-supplied `total`, `subtotal`, or `vat_*`.
- **Never `insert({ ...clientObject })`.** Name every column explicitly. A spread
  is a write into every column, including `total`.
- **Email links come from `APP_URL`, never `req.headers.host`.** The host header
  is attacker-controlled; using it lets a reset link point at another server.
- **Stock movements go through the SQL functions** (`produce_recipe`,
  `adjust_stock_qty`), not read-then-write in JS, or concurrent requests lose
  updates / double-spend materials.
- **`VAT_RATE` in `pages/api/cashier/invoices.ts` is 0** by deliberate choice.
  Raising it changes what customers pay — a pricing decision, not a code fix.
- **Rate limits**: password success may reset the *account* counter; the
  *access-code* counter is never reset (see the comment in `login.ts`).

## Two different costs — don't mix them

A page that renders a figure on the server *and* re-fetches it from an API must
get both from the same function, or the number changes on refresh:

- **COGS** — Σ(recipe unit cost × units sold). What the reports page means by
  "إجمالي التكلفة", and what its product table adds up to.
- **Purchase spend** — Σ of the `purchases` table for the period. Cash out this
  month, regardless of when the material gets used. Zero in a month where
  nothing was bought, even with plenty of sales.

`lib/reports.ts` → `buildReport(bakery_id, query)` is the single source for the
reports page: both `pages/reports.tsx` (getServerSideProps) and `/api/reports`
(the 30-second refresh) call it. It returns COGS as `totals.cost` and purchase
spend separately as `totals.purchaseCost`. **Compute neither figure inline in a
page or route.** The dashboard's `monthProfit` is deliberately the purchase-based
one.

**The period travels with the request.** `lib/reportRange.ts` → `resolveRange()`
turns the query string into `{from, to, days, prev}`; both the page and the API
pass their own query through, so the auto-refresh cannot snap the view back to
the current month. Bad input falls back to month-to-date rather than erroring,
and a custom range is capped at 731 days. Bounds are inclusive of both end days
(`fromBound`/`toBound`) because the SQL aggregates compare `>= p_from AND
<= p_to` — passing a bare date as `p_to` silently drops that day's sales.

## "Today" is the bakery's day, not UTC's

**Never derive a calendar date from `toISOString()`.** Riyadh is UTC+3, so from
midnight to 3am the UTC date is still yesterday's — the hours a bakery is busiest.
`lib/businessDay.ts` is the only place that converts between instants and dates:

| Use | Instead of |
|---|---|
| `businessToday()` | `new Date().toISOString().split('T')[0]` |
| `dayStart(d)` / `dayEnd(d)` | `d + 'T00:00:00'` / a bare date as an upper bound |
| `dayStamp(d)` | `new Date(d + 'T12:00:00')` — parsed in the *server's* zone |
| `isOnDay(instant, d)` | `created_at.startsWith(d)` |

`BUSINESS_OFFSET` is a fixed `+03:00` because Saudi Arabia has never observed
daylight saving. The SQL side must agree: `sales_daily_totals` buckets with
`AT TIME ZONE 'Asia/Riyadh'` since `006`, so **apply 006 before deploying** or
the chart buckets in UTC while the cards above it are bounded in Riyadh time.

## Testing without a real database

```
npm test         # the suite
npm run typecheck
npm run build
```

All three run on every push and pull request (`.github/workflows/ci.yml`).

`.env.local` is a stub, so nothing here can reach Supabase. `scripts/test.mjs`
compiles `lib/`, `pages/api/` and `tests/` to `.test-build/`, then copies the
compiled `tests/support/supabase-stub.js` over `.test-build/lib/supabase.js`.
Every module under test then talks to the stub without knowing it, which is why
the project needs no mocking library — and no test framework either, since
Node's own runner does the rest.

Fixtures live on `globalThis`, reached through `tests/support/db.ts`
(`seed`, `onRpc`, `failWith`, `setLatency`, `calls`). The stub and that helper
each define the accessor separately **on purpose**: the stub is copied to another
directory before it runs, so a shared relative import would break.

**Two caches will leak between tests if you forget them** — `invalidateUserCache`
(30s) and `invalidateSubscriptionCache` (60s). Clear both in `beforeEach` for any
test that changes a `users` or `bakeries` row, or you will be asserting against
the previous test's snapshot.

When stubbing an RPC, match the **real function's return shape** from the
migration, not a convenient one: `rate_limit_hit` returns
`{ allowed, retry_after_sec }`, not the raw counter.

The SQL functions themselves can only be exercised against a real database, i.e.
on Preview or Production.

## Post-deploy smoke test

Log in → dashboard → reports → **produce a batch** → record a purchase → edit a
stock item, then check the edit was logged:

```sql
SELECT action, actor_name, created_at FROM audit_log ORDER BY created_at DESC LIMIT 3;
```

Produce first — it exercises the most (recipe read, atomic stock deduction,
production log, finished-goods upsert).
