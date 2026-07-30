import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv, reportCsv } from '../lib/csv'
import type { ReportPayload } from '../lib/reports'

/**
 * The export is how a report leaves the system, and product names are typed by
 * users — so the two things that matter are that a name cannot break out of its
 * cell, and that a name cannot become a formula when the file is opened.
 */

describe('toCsv', () => {
  test('leaves plain values unquoted', () => {
    assert.equal(toCsv([['كرواسون', 12, 0.475]]), 'كرواسون,12,0.475')
  })

  test('quotes a value containing a comma so it stays one cell', () => {
    assert.equal(toCsv([['كيك, شوكولاتة', 5]]), '"كيك, شوكولاتة",5')
  })

  test('doubles an embedded quote rather than ending the field', () => {
    assert.equal(toCsv([['قال "مرحبا"']]), '"قال ""مرحبا"""')
  })

  test('a newline inside a name cannot start a new row', () => {
    const out = toCsv([['سطر\nثاني', 1], ['بعده', 2]])
    assert.equal(out.split('\r\n').length, 2, 'two rows, not three')
  })

  test('defuses a value Excel would run as a formula', () => {
    // A product named =1+1 or -SUM(...) is executed on open. This is the
    // injection that turns an export into code running on the accountant's
    // machine, so the value is prefixed and quoted rather than dropped.
    for (const evil of ['=1+1', '+cmd', '-2+3', '@SUM(A1)']) {
      const out = toCsv([[evil]])
      assert.ok(out.startsWith("'") || out.startsWith('"\''), `${evil} → ${out}`)
      assert.ok(out.includes(evil), 'the original text is still readable')
    }
  })

  test('empty and missing values are empty cells, not "null"', () => {
    assert.equal(toCsv([[null, '', 0]]), ',,0')
  })
})

const REPORT = {
  range: { preset: 'month', from: '2026-07-01', to: '2026-07-15', days: 15, prev: { from: '2026-06-01', to: '2026-06-15' } },
  data: [
    { name: 'كرواسون', qty: 6, revenue: 72, cost: 2.85, profit: 69.15, margin: 96.04, unitCost: 0.475, sellPrice: 12, prevQty: 4, share: 61.3 },
    { name: 'كيك', qty: 7, revenue: 45.5, cost: 1.68, profit: 43.82, margin: 96.31, unitCost: 0.24, sellPrice: 6.5, prevQty: null, share: 38.7 },
  ],
  totals: { revenue: 117.5, cost: 4.53, profit: 112.97, avgMargin: 96.14, purchaseCost: 5000, productsSold: 2, unitsSold: 13 },
  previous: { revenue: 48, cost: 1.9, profit: 46.1, purchaseCost: 0 },
  change: { revenue: 144.79, cost: 138.4, profit: 145.05, purchaseCost: null },
  prodSummary: [{ recipe_name: 'كرواسون', output_unit: 'حبة', total: 40, unitCost: 0.475, totalCost: 19 }],
  daily: [],
  warnings: [],
} as unknown as ReportPayload

describe('reportCsv', () => {
  test('carries the period and the window it is compared against', () => {
    const rows = reportCsv(REPORT, 'ar')
    const flat = rows.map(r => r.join(','))
    assert.ok(flat.some(r => r.includes('2026-07-01') && r.includes('2026-07-15')))
    assert.ok(flat.some(r => r.includes('2026-06-01') && r.includes('2026-06-15')))
  })

  test('has one row per product', () => {
    const rows = reportCsv(REPORT, 'ar')
    assert.ok(rows.some(r => r[0] === 'كرواسون' && r[3] === 6))
    assert.ok(rows.some(r => r[0] === 'كيك' && r[3] === 7))
  })

  test('a product with no sales last period leaves the cell empty, not zero', () => {
    // Zero would read as "sold none"; empty reads as "was not on the menu".
    const cake = reportCsv(REPORT, 'ar').find(r => r[0] === 'كيك')!
    assert.equal(cake[4], null)
  })

  test('the totals row adds up to what the product rows say', () => {
    // Taken by position: matching on the name would also catch the production
    // section, and matching on the column count would catch the totals row.
    const rows = reportCsv(REPORT, 'ar')
    const head = rows.findIndex(r => r[0] === 'المنتج')
    const products = rows.slice(head + 1, rows.findIndex((r, i) => i > head && r.length === 0))
    assert.equal(products.length, 2)
    assert.equal(products.reduce((s, r) => s + (r[5] as number), 0), 117.5)
  })

  test('includes purchase spend as its own line, never folded into cost', () => {
    const rows = reportCsv(REPORT, 'ar')
    assert.ok(rows.some(r => String(r[0]).includes('الشراء') && r[1] === 5000))
    assert.ok(!rows.some(r => r[6] === 5000), 'purchase spend is not the cost of goods')
  })

  test('renders in English when the page is in English', () => {
    const flat = reportCsv(REPORT, 'en').map(r => r.join(','))
    assert.ok(flat[0].includes('Bakex report'))
    assert.ok(flat.some(r => r.includes('Product') && r.includes('Margin %')))
  })

  test('survives a report with nothing in it', () => {
    const empty = { ...REPORT, data: [], prodSummary: [], totals: { ...REPORT.totals, unitsSold: 0 } } as ReportPayload
    const csv = toCsv(reportCsv(empty, 'ar'))
    assert.ok(csv.length > 0)
    assert.ok(!csv.includes('undefined'))
  })
})
