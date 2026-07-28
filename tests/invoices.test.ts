import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db, resetDb, seed, onRpc, daysFromNow } from './support/db'
import { signToken, invalidateUserCache } from '../lib/auth'
import { invalidateSubscriptionCache } from '../lib/subscription'
import handler from '../pages/api/cashier/invoices'

/**
 * Invoices used to write the client's own total, subtotal and VAT straight to
 * the record after validating `items` and then ignoring them — so a till could
 * ring up 500 and post a total of 5, pocket the difference, and file a tax
 * record showing 5. Money is derived from the line items here.
 */

const CASHIER = {
  id: 'u-till', token_version: 1, status: 'active',
  role: 'staff', perms: { sales: true }, bakery_id: 'b1',
}

const token = (over: any = {}) => signToken({
  id: CASHIER.id, tv: CASHIER.token_version, role: CASHIER.role,
  perms: CASHIER.perms, bakery_id: CASHIER.bakery_id, ...over,
})

function mock(body: any, method = 'POST') {
  const req: any = { method, headers: { cookie: `bakex_token=${token()}` }, body, query: {} }
  const res: any = {
    code: 200, body: null, headers: {},
    status(c: number) { res.code = c; return res },
    json(b: any) { res.body = b; return res },
    end() { return res },
    setHeader(k: string, v: any) { res.headers[k] = v; return res },
  }
  return { req, res }
}

beforeEach(() => {
  resetDb()
  invalidateUserCache(CASHIER.id)
  invalidateSubscriptionCache('b1')
  seed('users', [{ ...CASHIER }])
  seed('bakeries', [{ id: 'b1', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(90) }])
  seed('invoices', [])
  seed('sales', [])
  onRpc('next_invoice_seq', () => 1)
  onRpc('adjust_stock_qty', () => null)
})

describe('POST /api/cashier/invoices', () => {
  test('computes the total from the items and ignores the one it was sent', async () => {
    const { req, res } = mock({
      items: [{ name: 'كرواسون', qty: 10, price: 12 }, { name: 'كيك', qty: 2, price: 20 }],
      total: 5, subtotal: 5, vat_amount: 0, vat_rate: 0.99,
    })
    await handler(req, res)
    assert.equal(res.code, 200)
    const invoice = db().tables['invoices'][0]
    assert.equal(invoice.total, 160, '10x12 + 2x20 = 160, whatever the caller claimed')
    assert.equal(invoice.subtotal, 160)
  })

  test('the sales rows match the invoice, so the books reconcile with themselves', async () => {
    const { req, res } = mock({ items: [{ name: 'كرواسون', qty: 10, price: 12 }], total: 5 })
    await handler(req, res)
    const invoice = db().tables['invoices'][0]
    const salesTotal = db().tables['sales'].reduce((s: number, r: any) => s + r.total, 0)
    assert.equal(salesTotal, invoice.total)
  })

  test('stores only the item fields it validated', async () => {
    const { req, res } = mock({
      items: [{ name: 'كرواسون', qty: 1, price: 12, cost_override: 0, note: 'x'.repeat(500) }],
    })
    await handler(req, res)
    const item = db().tables['invoices'][0].items[0]
    assert.deepEqual(Object.keys(item).sort(), ['id', 'name', 'price', 'qty'])
  })

  test('rejects a negative price rather than crediting the till', async () => {
    const { req, res } = mock({ items: [{ name: 'x', qty: 1, price: -100 }] })
    await handler(req, res)
    assert.equal(res.code, 400)
    assert.equal(db().tables['invoices'].length, 0)
  })

  test('rejects a non-numeric quantity', async () => {
    const { req, res } = mock({ items: [{ name: 'x', qty: 'many' as any, price: 5 }] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('rejects an empty basket', async () => {
    const { req, res } = mock({ items: [] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('refuses a zero total', async () => {
    const { req, res } = mock({ items: [{ name: 'x', qty: 1, price: 0 }] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('requires the sales permission', async () => {
    seed('users', [{ ...CASHIER, perms: { stock: true } }])
    invalidateUserCache(CASHIER.id)
    const { req, res } = mock({ items: [{ name: 'x', qty: 1, price: 5 }] })
    await handler(req, res)
    assert.equal(res.code, 403)
    assert.equal(db().tables['invoices'].length, 0)
  })

  test('deducts stock through the SQL function, not a read-then-write', async () => {
    // Two tills selling at once both read the same figure and one deduction was
    // lost, so the movement has to be a single statement in the database.
    const { req, res } = mock({ items: [{ name: 'كرواسون', qty: 3, price: 12 }] })
    await handler(req, res)
    const moves = db().calls.filter(c => c.target === 'adjust_stock_qty')
    assert.equal(moves.length, 1)
    assert.equal(moves[0].args.p_delta ?? moves[0].args.delta ?? moves[0].args.p_qty, -3)
  })

  test('VAT stays at zero, matching what the cashier has always sent', async () => {
    const { req, res } = mock({ items: [{ name: 'x', qty: 1, price: 100 }], vat_rate: 0.15 })
    await handler(req, res)
    const invoice = db().tables['invoices'][0]
    assert.equal(invoice.vat_rate, 0)
    assert.equal(invoice.vat_amount, 0)
    assert.equal(invoice.total, 100, 'raising VAT is a pricing decision, not something a request can do')
  })
})
