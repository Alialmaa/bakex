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

## Testing without a real database

`.env.local` here is a stub, so Supabase-backed paths can't run locally. Logic
is checked by compiling the relevant modules and running them against a stubbed
`supabaseAdmin` — see the pattern used during the security work. `tsc --noEmit`
and `next build` are the fast gates. The SQL functions themselves can only be
exercised against a real database, i.e. on Preview or Production.

## Post-deploy smoke test

Log in → dashboard → reports → **produce a batch** → record a purchase → edit a
stock item, then check the edit was logged:

```sql
SELECT action, actor_name, created_at FROM audit_log ORDER BY created_at DESC LIMIT 3;
```

Produce first — it exercises the most (recipe read, atomic stock deduction,
production log, finished-goods upsert).
