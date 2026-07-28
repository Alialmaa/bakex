import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb, seed, onRpc, failWith, calls, setLatency, daysFromNow } from './support/db'
import { signToken, requirePage, requireAuth, isRedirect, hasValidSession, invalidateUserCache } from '../lib/auth'
import { invalidateSubscriptionCache } from '../lib/subscription'

/**
 * These cover the access-control rules the app depends on. Each one stands for a
 * way in that was open at some point, so a failure here is a regression, not a
 * style disagreement.
 */

const USER = {
  id: 'u-1', token_version: 3, status: 'active',
  role: 'admin', perms: { reports: true, sales: true }, bakery_id: 'bak-live',
}

const req = (token: string, extraCookie = '') => ({
  headers: { cookie: `bakex_token=${token}${extraCookie}` },
}) as any

const tokenFor = (u: any = USER, over: any = {}) => signToken({
  id: u.id, tv: u.token_version, role: u.role, perms: u.perms, bakery_id: u.bakery_id, ...over,
})

function mockRes() {
  const res: any = {
    code: 0, body: null,
    status(c: number) { res.code = c; return res },
    json(b: any) { res.body = b; return res },
    end() { return res },
    setHeader() { return res },
  }
  return res
}

beforeEach(() => {
  resetDb()
  // Both caches live inside their modules — 30s for the user, 60s for the
  // subscription — so a test that changes a row would otherwise be answered
  // from the previous test's snapshot.
  invalidateUserCache('u-1')
  invalidateUserCache('u-super')
  for (const b of ['bak-live', 'bak-dead', 'bak-paid']) invalidateSubscriptionCache(b)
  seed('users', [
    { ...USER },
    { id: 'u-super', token_version: 0, status: 'active', role: 'super_admin', perms: {}, bakery_id: null },
  ])
  seed('bakeries', [
    { id: 'bak-live', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(300) },
    { id: 'bak-dead', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(-10) },
    { id: 'bak-paid', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(300) },
  ])
})

describe('requirePage — page guard', () => {
  test('lets a valid session through with role and perms from the database', async () => {
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(!isRedirect(r))
    assert.equal((r as any).user.id, 'u-1')
    assert.equal((r as any).user.role, 'admin')
  })

  test('rejects a token whose version the database has moved past', async () => {
    // Bumping token_version is how logout, password change and account
    // suspension revoke every session that is already out there.
    const r = await requirePage(req(tokenFor(USER, { tv: 2 })), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/login')
  })

  test('rejects a suspended account', async () => {
    seed('users', [{ ...USER, status: 'rejected' }])
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/login')
  })

  test('rejects a token with no tv claim at all', async () => {
    // Tokens predating revocation support cannot be checked against anything,
    // so their absence must not be read as "nothing to check".
    const r = await requirePage(req(signToken({ id: 'u-1', bakery_id: 'bak-live' })), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/login')
  })

  test('rejects a cookie that is not a token', async () => {
    const r = await requirePage(req('not-a-jwt'), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/login')
  })

  test('takes role from the database, not from the token', async () => {
    // A demoted user still holds a token that claims the old role.
    seed('users', [{ ...USER, role: 'staff', perms: { sales: true } }])
    const r = await requirePage(req(tokenFor(USER, { role: 'admin', perms: { reports: true } })), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/403')
  })

  test('denies a page the user holds no permission for', async () => {
    const r = await requirePage(req(tokenFor()), { anyPerm: ['users'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/403')
  })

  test('sends an expired subscription to billing', async () => {
    seed('users', [{ ...USER, bakery_id: 'bak-dead' }])
    const r = await requirePage(req(tokenFor(USER, { bakery_id: 'bak-dead' })), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/billing')
  })

  test('a token claiming a paid bakery cannot buy access for an expired one', async () => {
    // The subscription lookup is started from the token's bakery_id so it can
    // run alongside the user lookup. The result is only usable when the two
    // agree — this is the case that proves the guard still decides.
    seed('users', [{ ...USER, bakery_id: 'bak-dead' }])
    const r = await requirePage(req(tokenFor(USER, { bakery_id: 'bak-paid' })), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/billing')
    assert.ok(calls().some(c => c.target === 'bakeries'), 'the real bakery must be read after the mismatch')
  })

  test('refuses rather than allows when the database is unreadable', async () => {
    failWith('users:select', 'connection reset')
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r) && r.redirect.destination === '/500')
  })

  test('an unreadable bakery row denies access instead of crashing', async () => {
    failWith('bakeries:select', 'connection reset')
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(isRedirect(r))
  })

  test('pages that skip the subscription check never read it', async () => {
    seed('users', [{ ...USER, bakery_id: 'bak-dead' }])
    const r = await requirePage(req(tokenFor(USER, { bakery_id: 'bak-dead' })), { skipSubscription: true })
    assert.ok(!isRedirect(r), 'billing and settings must stay reachable once expired')
    assert.equal(calls().filter(c => c.target === 'bakeries').length, 0)
  })

  test('super admins pass without a bakery, and can be routed elsewhere', async () => {
    const t = signToken({ id: 'u-super', tv: 0, bakery_id: null })
    const open = await requirePage(req(t), {})
    assert.ok(!isRedirect(open) && (open as any).user.role === 'super_admin')

    invalidateUserCache('u-super')
    const routed = await requirePage(req(t), { redirectSuperAdminTo: '/bakeries' })
    assert.ok(isRedirect(routed) && routed.redirect.destination === '/bakeries')
  })

  test('the two guard lookups overlap instead of queueing', async () => {
    setLatency(40)
    const started = Date.now()
    await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    const took = Date.now() - started
    assert.ok(took < 40 * 1.9, `two 40ms lookups took ${took}ms — they are running back to back`)
  })
})

describe('requirePage — what it hands the page', () => {
  test('carries the language cookie so the server renders the right one', async () => {
    const r = await requirePage(req(tokenFor(), '; bakex_lang=en'), { anyPerm: ['reports'] })
    assert.ok(!isRedirect(r))
    assert.equal((r as any).user.lang, 'en')
  })

  test('omits lang entirely when there is no cookie', async () => {
    // getServerSideProps refuses to serialize undefined, so the key must be
    // absent rather than present-and-undefined.
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(!isRedirect(r))
    assert.ok(!('lang' in (r as any).user))
    assert.doesNotThrow(() => JSON.parse(JSON.stringify({ user: (r as any).user })))
  })

  test('carries the subscription so the sidebar need not fetch it', async () => {
    seed('bakeries', [{ id: 'bak-live', subscription_status: 'trial', trial_ends_at: daysFromNow(5), subscription_ends_at: null }])
    const r = await requirePage(req(tokenFor()), { anyPerm: ['reports'] })
    assert.ok(!isRedirect(r))
    assert.equal((r as any).user.billing.status, 'trial')
    assert.equal((r as any).user.billing.daysLeft, 5)
  })
})

describe('requireAuth — API guard', () => {
  test('valid session passes', async () => {
    const res = mockRes()
    const user = await requireAuth(req(tokenFor()), res)
    assert.equal(user?.id, 'u-1')
  })

  test('revoked token gets 401', async () => {
    const res = mockRes()
    assert.equal(await requireAuth(req(tokenFor(USER, { tv: 2 })), res), null)
    assert.equal(res.code, 401)
  })

  test('expired subscription gets 402, not data', async () => {
    seed('users', [{ ...USER, bakery_id: 'bak-dead' }])
    const res = mockRes()
    assert.equal(await requireAuth(req(tokenFor(USER, { bakery_id: 'bak-paid' })), res), null)
    assert.equal(res.code, 402)
  })

  test('database failure gets 503 and never a user', async () => {
    failWith('users:select', 'down')
    const res = mockRes()
    assert.equal(await requireAuth(req(tokenFor()), res), null)
    assert.equal(res.code, 503)
  })

  test('no cookie gets 401', async () => {
    const res = mockRes()
    assert.equal(await requireAuth({ headers: {} } as any, res), null)
    assert.equal(res.code, 401)
  })
})

describe('hasValidSession — used by the login pages', () => {
  test('true for a live session', async () => {
    assert.equal(await hasValidSession(req(tokenFor())), true)
  })

  test('false for a revoked one, so /login and /dashboard cannot bounce forever', async () => {
    assert.equal(await hasValidSession(req(tokenFor(USER, { tv: 99 }))), false)
  })

  test('false when the database is unreachable', async () => {
    failWith('users:select', 'down')
    assert.equal(await hasValidSession(req(tokenFor())), false)
  })
})
