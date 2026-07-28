import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db, resetDb, onRpc, seed, failWith, callsTo } from './support/db'
import { checkRateLimit, peekRateLimit, resetRateLimit, RATE_LIMITS } from '../lib/rateLimit'

/**
 * The counters that stand between an attacker and an account.
 *
 * They lived in a per-process Map once, which on serverless meant they reset
 * constantly and the limit never actually applied. They are in Postgres now, so
 * what matters here is the semantics the callers rely on.
 */

/**
 * Stands in for the rate_limit_hit SQL function from migration 002, including
 * its return shape ({ allowed, retry_after_sec }) and its `hits <= max` rule.
 * It also writes the rate_limits row, because peekRateLimit reads that table
 * directly rather than calling the function.
 */
function installCounter() {
  onRpc('rate_limit_hit', ({ p_key, p_window_sec, p_max }: any) => {
    const now = Date.now()
    const tbl = db().tables['rate_limits'] ?? (db().tables['rate_limits'] = [])
    let row = tbl.find((r: any) => r.key === p_key)
    if (!row) {
      row = { key: p_key, hits: 0, window_start: new Date(now).toISOString() }
      tbl.push(row)
    }
    if (now - new Date(row.window_start).getTime() > p_window_sec * 1000) {
      row.hits = 0
      row.window_start = new Date(now).toISOString()
    }
    row.hits++
    const endsAt = new Date(row.window_start).getTime() + p_window_sec * 1000
    return [{ allowed: row.hits <= p_max, retry_after_sec: Math.max(0, Math.ceil((endsAt - now) / 1000)) }]
  })
}

const rule = { windowSec: 60, max: 3 }

beforeEach(() => {
  resetDb()
})

describe('checkRateLimit', () => {
  test('allows exactly max attempts, then refuses', async () => {
    installCounter()
    const results = []
    for (let i = 0; i < 5; i++) results.push((await checkRateLimit('k', rule)).allowed)
    assert.deepEqual(results, [true, true, true, false, false])
  })

  test('counts each key separately', async () => {
    installCounter()
    for (let i = 0; i < 3; i++) await checkRateLimit('a', rule)
    assert.equal((await checkRateLimit('a', rule)).allowed, false)
    assert.equal((await checkRateLimit('b', rule)).allowed, true)
  })

  test('serialises concurrent callers rather than letting them all through', async () => {
    // Fifty requests arriving together used to each read the same count and
    // each decide they were within the limit.
    installCounter()
    const outcomes = await Promise.all(Array.from({ length: 50 }, () => checkRateLimit('storm', rule)))
    assert.equal(outcomes.filter(o => o.allowed).length, rule.max)
  })

  test('falls back to memory rather than opening the gate when the database fails', async () => {
    failWith('rpc:rate_limit_hit', 'down')
    const first = await checkRateLimit('fallback', { windowSec: 60, max: 2 })
    assert.equal(first.allowed, true)
    await checkRateLimit('fallback', { windowSec: 60, max: 2 })
    const third = await checkRateLimit('fallback', { windowSec: 60, max: 2 })
    assert.equal(third.allowed, false, 'a backend outage must degrade protection, not remove it')
  })
})

describe('peekRateLimit', () => {
  test('reads without counting', async () => {
    installCounter()
    for (let i = 0; i < 3; i++) await peekRateLimit('quiet', rule)
    assert.equal((await checkRateLimit('quiet', rule)).allowed, true, 'peeking must not consume the budget')
  })

  test('answers "is there room for one more", not "were we under the limit"', async () => {
    // The distinction is an off-by-one that would hand out one extra attempt:
    // after max failures peek must already say no, because the next call is the
    // one that would exceed it.
    installCounter()
    for (let i = 0; i < rule.max; i++) await checkRateLimit('edge', rule)
    assert.equal((await peekRateLimit('edge', rule)).allowed, false)
  })
})

describe('resetRateLimit', () => {
  test('clears a counter', async () => {
    installCounter()
    seed('rate_limits', [{ key: 'gone', hits: 9, window_start: new Date().toISOString() }])
    await resetRateLimit('gone')
    assert.equal(callsTo('rate_limits').some(c => c.kind === 'delete'), true)
  })
})

describe('the configured limits', () => {
  test('login is limited per IP and, separately, per account', async () => {
    assert.ok(RATE_LIMITS.login.max > 0 && RATE_LIMITS.loginAccount.max > 0)
    assert.ok(
      RATE_LIMITS.loginAccount.windowSec >= RATE_LIMITS.login.windowSec,
      'the account window must outlast the IP window, or rotating IPs defeats it'
    )
  })

  test('password reset is limited, because each attempt sends a billable email', async () => {
    assert.ok(RATE_LIMITS.passwordReset.max > 0)
    assert.ok(RATE_LIMITS.passwordReset.windowSec >= 600)
  })
})
