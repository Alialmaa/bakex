import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { db, resetDb, seed, onRpc, callsTo, failWith } from './support/db'
import { invalidateSubscriptionCache } from '../lib/subscription'
import { evaluatePayment, verifyWebhookToken, expectedAmountHalalas } from '../lib/moyasar'
import handler from '../pages/api/payments/moyasar'

/**
 * The webhook is the one endpoint that grants a paid subscription with no human
 * in the loop, and its URL will be public the moment it is configured. Every
 * test here is an attempt to get a free year out of it.
 *
 * The rule the whole route is built on: a forged POST can supply nothing but a
 * payment id, because everything that decides the outcome is read back from
 * Moyasar. So most of these send a *perfectly convincing body* and check that
 * it made no difference.
 */

const TOKEN = 'whsec-correct-horse'
const PRICE = 250_000 // 2,500 SAR in halalas

/** A payment as Moyasar's API would return it. */
const paid = (over: any = {}) => ({
  id: 'pay_123',
  status: 'paid',
  amount: PRICE,
  currency: 'SAR',
  refunded: 0,
  metadata: { bakery_id: 'b1' },
  ...over,
})

/** The webhook body — deliberately generous, and deliberately never believed. */
const webhookBody = (over: any = {}) => ({
  id: 'evt_999',
  type: 'payment_paid',
  secret_token: TOKEN,
  data: { id: 'pay_123', status: 'paid', amount: PRICE, currency: 'SAR', metadata: { bakery_id: 'b1' } },
  ...over,
})

let fetches: string[] = []
let realFetch: typeof fetch

/** Makes the next lookup answer with `payload`, or a bare status. */
function onLookup(payload: any, status = 200) {
  ;(globalThis as any).fetch = async (url: any) => {
    fetches.push(String(url))
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as any
  }
}

function onLookupThrowing() {
  ;(globalThis as any).fetch = async (url: any) => {
    fetches.push(String(url))
    throw new Error('network down')
  }
}

function mock(body: any, method = 'POST', headers: any = {}) {
  const req: any = { method, headers, body, query: {} }
  const res: any = {
    code: 200, body: null, headers: {},
    status(c: number) { res.code = c; return res },
    json(b: any) { res.body = b; return res },
    end() { return res },
    setHeader(k: string, v: any) { res.headers[k] = v; return res },
  }
  return { req, res }
}

const applied: any[] = []

beforeEach(() => {
  resetDb()
  invalidateSubscriptionCache('b1')
  fetches = []
  applied.length = 0
  realFetch = globalThis.fetch
  process.env.MOYASAR_SECRET_KEY = 'sk_test_key'
  process.env.MOYASAR_WEBHOOK_TOKEN = TOKEN

  seed('bakeries', [{ id: 'b1', subscription_status: 'trial', subscription_ends_at: null }])
  seed('audit_log', [])

  // Mirrors migrations/005: ON CONFLICT DO NOTHING makes the second delivery a
  // no-op, and the return shape is the function's, not a convenient one.
  onRpc('apply_subscription_payment', (args: any) => {
    if (!db().tables['bakeries'].some((b: any) => b.id === args.p_bakery_id)) {
      return { applied: false, duplicate: false, reason: 'unknown_bakery' }
    }
    if (applied.some(a => a.p_provider === args.p_provider && a.p_payment_id === args.p_payment_id)) {
      return { applied: false, duplicate: true, ends_at: '2027-01-01T00:00:00Z' }
    }
    applied.push(args)
    return { applied: true, duplicate: false, ends_at: '2027-01-01T00:00:00Z' }
  })

  onLookup(paid())
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.MOYASAR_SECRET_KEY
  delete process.env.MOYASAR_WEBHOOK_TOKEN
})

describe('POST /api/payments/moyasar — the token gate', () => {
  test('a forged token is rejected, and costs us no call to Moyasar', async () => {
    const { req, res } = mock(webhookBody({ secret_token: 'whsec-wrong' }))
    await handler(req, res)
    assert.equal(res.code, 401)
    assert.deepEqual(fetches, [], 'a stranger must not be able to make us call the gateway')
    assert.equal(applied.length, 0)
  })

  test('a token that is a prefix of the real one is rejected', async () => {
    const { req, res } = mock(webhookBody({ secret_token: TOKEN.slice(0, -1) }))
    await handler(req, res)
    assert.equal(res.code, 401)
  })

  test('no token at all is rejected', async () => {
    const { req, res } = mock(webhookBody({ secret_token: undefined }))
    await handler(req, res)
    assert.equal(res.code, 401)
  })

  test('the token may arrive in the header instead of the body', async () => {
    const { req, res } = mock(webhookBody({ secret_token: undefined }), 'POST', { 'x-moyasar-token': TOKEN })
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(applied.length, 1)
  })

  test('GET is not a way in', async () => {
    const { req, res } = mock(webhookBody(), 'GET')
    await handler(req, res)
    assert.equal(res.code, 405)
  })

  test('with the gateway unconfigured every request is refused', async () => {
    delete process.env.MOYASAR_WEBHOOK_TOKEN
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 503)
    assert.equal(applied.length, 0)
  })
})

describe('POST /api/payments/moyasar — the body is not evidence', () => {
  test('a body claiming a paid 2,500 is worthless when the real payment is 1 riyal', async () => {
    onLookup(paid({ amount: 100 }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.ignored, 'wrong_amount')
    assert.equal(applied.length, 0, 'one riyal does not buy a year')
  })

  test('a body claiming paid is worthless when the real payment failed', async () => {
    onLookup(paid({ status: 'failed' }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.body.ignored, 'not_paid')
    assert.equal(applied.length, 0)
  })

  test('the bakery comes from Moyasar metadata, not from the body', async () => {
    // The attacker names their own bakery in the POST; the payment says b1.
    onLookup(paid({ metadata: { bakery_id: 'b1' } }))
    const { req, res } = mock(webhookBody({ data: { id: 'pay_123', metadata: { bakery_id: 'attacker' } } }))
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(applied[0].p_bakery_id, 'b1')
  })

  test('an id Moyasar has never seen activates nothing', async () => {
    onLookup(null, 404)
    const { req, res } = mock(webhookBody({ data: { id: 'pay_invented' } }))
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.ignored, 'unknown_payment')
    assert.equal(applied.length, 0)
  })

  test('a missing payment id is a 400, not a lookup', async () => {
    const { req, res } = mock({ secret_token: TOKEN })
    await handler(req, res)
    assert.equal(res.code, 400)
    assert.deepEqual(fetches, [])
  })

  test('the amount charged is what gets recorded', async () => {
    const { req, res } = mock(webhookBody({ data: { id: 'pay_123', amount: 999_999 } }))
    await handler(req, res)
    assert.equal(applied[0].p_amount_halalas, PRICE)
  })
})

describe('POST /api/payments/moyasar — payments that do not qualify', () => {
  test('a refunded payment does not buy access', async () => {
    onLookup(paid({ refunded: PRICE }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.body.ignored, 'refunded')
  })

  test('another currency is refused even at the right number', async () => {
    onLookup(paid({ currency: 'USD' }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.body.ignored, 'wrong_currency')
  })

  test('a payment with no bakery in its metadata is refused, not guessed at', async () => {
    onLookup(paid({ metadata: {} }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.body.ignored, 'no_bakery')
    assert.equal(applied.length, 0)
  })

  test('a bakery that no longer exists is refused by the function, not by the route', async () => {
    onLookup(paid({ metadata: { bakery_id: 'gone' } }))
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.ignored, 'unknown_bakery')
  })
})

describe('POST /api/payments/moyasar — retries and failures', () => {
  test('the same payment delivered twice grants one year, not two', async () => {
    const first = mock(webhookBody())
    await handler(first.req, first.res)
    const second = mock(webhookBody())
    await handler(second.req, second.res)

    assert.equal(first.res.body.applied, true)
    assert.equal(second.res.code, 200)
    assert.equal(second.res.body.duplicate, true)
    assert.equal(applied.length, 1, 'the second delivery must apply nothing')
  })

  test('a replay writes no second audit entry', async () => {
    const a = mock(webhookBody())
    await handler(a.req, a.res)
    const b = mock(webhookBody())
    await handler(b.req, b.res)
    assert.equal(db().tables['audit_log'].length, 1)
  })

  test('an unreachable Moyasar answers 5xx so the gateway tries again', async () => {
    onLookupThrowing()
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 502)
    assert.equal(applied.length, 0)
  })

  test('a 500 from Moyasar is our outage, not a verdict on the payment', async () => {
    onLookup(null, 500)
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 502)
  })

  test('a failing database answers 5xx rather than dropping a paid subscription', async () => {
    failWith('rpc:apply_subscription_payment', 'deadlock detected')
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(res.code, 500)
  })
})

describe('POST /api/payments/moyasar — what a good payment does', () => {
  test('records the payment, extends the subscription and leaves a trail', async () => {
    const { req, res } = mock(webhookBody())
    await handler(req, res)

    assert.equal(res.code, 200)
    assert.deepEqual(applied[0], {
      p_provider: 'moyasar',
      p_payment_id: 'pay_123',
      p_bakery_id: 'b1',
      p_amount_halalas: PRICE,
      p_currency: 'SAR',
      p_days: 365,
    })

    const entry = db().tables['audit_log'][0]
    assert.equal(entry.action, 'subscription.activate')
    assert.equal(entry.bakery_id, 'b1')
    assert.equal(entry.actor_id, null, 'no user did this')
    assert.equal(entry.details.payment_id, 'pay_123')
  })

  test('the lookup goes to the payment id, not to anything the body chose', async () => {
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(fetches.length, 1)
    assert.ok(fetches[0].startsWith('https://api.moyasar.com/v1/payments/'), fetches[0])
    assert.ok(fetches[0].endsWith('/pay_123'))
  })

  test('activation is only ever attempted once per call', async () => {
    const { req, res } = mock(webhookBody())
    await handler(req, res)
    assert.equal(callsTo('apply_subscription_payment').length, 1)
  })
})

describe('the rules on their own', () => {
  test('the expected amount is in halalas', () => {
    assert.equal(expectedAmountHalalas(), 250_000)
  })

  test('verifyWebhookToken refuses non-strings and empties', () => {
    assert.equal(verifyWebhookToken(undefined, TOKEN), false)
    assert.equal(verifyWebhookToken('', TOKEN), false)
    assert.equal(verifyWebhookToken(null, TOKEN), false)
    assert.equal(verifyWebhookToken({} as any, TOKEN), false)
    assert.equal(verifyWebhookToken(TOKEN, TOKEN), true)
  })

  test('evaluatePayment accepts exactly one shape of payment', () => {
    assert.deepEqual(evaluatePayment(paid() as any), { kind: 'accept', bakeryId: 'b1' })
    assert.equal((evaluatePayment(paid({ amount: PRICE - 1 }) as any) as any).reason, 'wrong_amount')
    assert.equal((evaluatePayment(paid({ amount: PRICE + 1 }) as any) as any).reason, 'wrong_amount')
    assert.equal((evaluatePayment(paid({ status: 'authorized' }) as any) as any).reason, 'not_paid')
  })

  test('lowercase sar is still riyals', () => {
    assert.equal((evaluatePayment(paid({ currency: 'sar' }) as any) as any).kind, 'accept')
  })

  test('a bakery_id of whitespace is no bakery_id', () => {
    assert.equal((evaluatePayment(paid({ metadata: { bakery_id: '   ' } }) as any) as any).reason, 'no_bakery')
  })
})
