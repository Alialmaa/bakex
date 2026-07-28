import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb, seed, onRpc } from './support/db'
import { buildReport } from '../lib/reports'
import { createSales } from '../lib/db/sales'
import { db } from './support/db'

/**
 * The reports page renders on the server and then refreshes itself from the API
 * every 30 seconds. Both paths call buildReport, because when they each computed
 * the figures their own way the total cost flipped between two different numbers
 * on a timer while the table below it stayed put.
 */

const RECIPES = [
  { id: 'r1', name: 'كرواسون', units_per_batch: 20, sell_price: 12, bakery_id: 'b1',
    ingredients: [{ material: 'دقيق', amount: 500 }, { material: 'زبدة', amount: 250 }] },
  { id: 'r2', name: 'كيك', units_per_batch: 10, sell_price: 6.5, bakery_id: 'b1',
    ingredients: [{ material: 'دقيق', amount: 300 }, { material: 'سكر', amount: 200 }] },
  { id: 'r3', name: 'لم يُبع', units_per_batch: 5, sell_price: 3, bakery_id: 'b1',
    ingredients: [{ material: 'سكر', amount: 100 }] },
]

const STOCK = [
  { name: 'دقيق', price_per_unit: 0.004, bakery_id: 'b1' },
  { name: 'سكر', price_per_unit: 0.006, bakery_id: 'b1' },
  { name: 'زبدة', price_per_unit: 0.03, bakery_id: 'b1' },
]

/** croissant: (500×0.004 + 250×0.03) / 20 = 0.475 ; cake: (300×0.004 + 200×0.006) / 10 = 0.24 */
const UNIT_COST = { r1: 0.475, r2: 0.24 }

function installAggregates({ purchases = 0 } = {}) {
  onRpc('sales_by_recipe', ({ p_to }: any) => p_to ? [] : [
    { recipe_id: 'r1', qty: 6, revenue: 72 },
    { recipe_id: 'r2', qty: 7, revenue: 45.5 },
  ])
  onRpc('sales_revenue', ({ p_to }: any) => (p_to ? 0 : 117.5))
  onRpc('production_by_recipe', () => [
    { recipe_id: 'r1', recipe_name: 'كرواسون', output_unit: 'حبة', total: 40 },
  ])
  onRpc('sales_daily_totals', () => [])
  onRpc('purchase_cost', () => purchases)
}

beforeEach(() => {
  resetDb()
  seed('recipes', RECIPES)
  seed('stock', STOCK)
})

describe('buildReport', () => {
  test('costs each product from its recipe and the stock prices', async () => {
    installAggregates()
    const rep = await buildReport('b1')
    const croissant = rep.data.find(d => d.name === 'كرواسون')!
    assert.equal(croissant.unitCost, UNIT_COST.r1)
    assert.equal(croissant.cost, UNIT_COST.r1 * 6)
    assert.equal(croissant.profit, 72 - UNIT_COST.r1 * 6)
  })

  test('leaves out products with no sales in the period', async () => {
    installAggregates()
    const rep = await buildReport('b1')
    assert.deepEqual(rep.data.map(d => d.name), ['كرواسون', 'كيك'])
  })

  test('the headline total equals the sum of the table beneath it', async () => {
    // This is the bug itself: the cards said 0 while the rows showed real costs.
    installAggregates({ purchases: 0 })
    const rep = await buildReport('b1')
    const fromRows = rep.data.reduce((s, d) => s + d.cost, 0)
    assert.equal(rep.totals.cost, fromRows)
    assert.ok(rep.totals.cost > 0, 'a month with sales and no purchases still has a cost of goods')
  })

  test('revenue and profit agree with the table too', async () => {
    installAggregates()
    const rep = await buildReport('b1')
    assert.equal(rep.totals.revenue, rep.data.reduce((s, d) => s + d.revenue, 0))
    assert.equal(rep.totals.profit, rep.totals.revenue - rep.totals.cost)
    assert.equal(rep.totals.avgMargin, (rep.totals.profit / rep.totals.revenue) * 100)
  })

  test('purchase spend is reported separately, never as the cost of goods', async () => {
    // Two different figures. Purchases are cash out this month; cost of goods is
    // what the month's sales consumed. Mixing them is what broke the page.
    installAggregates({ purchases: 5000 })
    const rep = await buildReport('b1')
    assert.equal(rep.totals.purchaseCost, 5000)
    assert.notEqual(rep.totals.cost, 5000)
    assert.equal(rep.totals.cost, rep.data.reduce((s, d) => s + d.cost, 0))
  })

  test('two calls return identical totals, so the refresh cannot disagree with the render', async () => {
    installAggregates({ purchases: 0 })
    const a = await buildReport('b1')
    const b = await buildReport('b1')
    assert.deepEqual(a.totals, b.totals)
  })

  test('costs production with the same unit cost as the sales table', async () => {
    installAggregates()
    const rep = await buildReport('b1')
    assert.equal(rep.prodSummary[0].unitCost, UNIT_COST.r1)
    assert.equal(rep.prodSummary[0].totalCost, 40 * UNIT_COST.r1)
  })

  test('an empty month produces zeroes, not NaN', async () => {
    onRpc('sales_by_recipe', () => [])
    onRpc('sales_revenue', () => 0)
    onRpc('production_by_recipe', () => [])
    onRpc('sales_daily_totals', () => [])
    onRpc('purchase_cost', () => 0)
    const rep = await buildReport('b1')
    for (const v of Object.values(rep.totals)) assert.ok(Number.isFinite(v as number), 'every total must be a number')
    assert.equal(rep.totals.avgMargin, 0)
  })

  test('an ingredient missing from stock costs nothing rather than poisoning the total', async () => {
    seed('stock', [{ name: 'دقيق', price_per_unit: 0.004, bakery_id: 'b1' }])
    installAggregates()
    const rep = await buildReport('b1')
    for (const row of rep.data) assert.ok(Number.isFinite(row.cost))
    assert.ok(Number.isFinite(rep.totals.cost))
  })
})

describe('createSales', () => {
  test('derives the line total instead of taking one from the caller', async () => {
    // The insert used to spread the caller's object, which handed the client a
    // write into every column — including the total every report sums.
    await createSales('b1', [{ recipe_id: 'r1', recipe_name: 'كرواسون', qty: 3, unit_price: 12, total: 1 } as any], 'u1')
    const row = db().tables['sales'][0]
    assert.equal(row.total, 36)
    assert.equal(row.bakery_id, 'b1')
    assert.equal(row.sold_by, 'u1')
  })

  test('writes only the columns it names', async () => {
    await createSales('b1', [{ recipe_id: 'r1', qty: 2, unit_price: 5, is_admin: true, price_override: 0 } as any], 'u1')
    const row = db().tables['sales'][0]
    assert.ok(!('is_admin' in row))
    assert.ok(!('price_override' in row))
  })

  test('rounds money to two places', async () => {
    await createSales('b1', [{ recipe_id: 'r1', qty: 3, unit_price: 3.333 }], 'u1')
    assert.equal(db().tables['sales'][0].total, 10)
  })
})
