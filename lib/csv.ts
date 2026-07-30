import type { ReportPayload } from './reports'

/**
 * CSV, built in the browser from figures already on screen.
 *
 * No export endpoint: the page has the whole payload, so a server round trip
 * would only add a second route to authorise and a second chance for the file
 * to disagree with what the user is looking at.
 */

/** Quotes a field only when it needs it, and never lets a value break the row. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // A leading =, +, - or @ is executed as a formula when the file is opened in
  // Excel. Product names are user input, so they get a leading apostrophe.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map(r => r.map(cell).join(',')).join('\r\n')
}

/**
 * Hands the file to the browser.
 *
 * The BOM is not optional: without it Excel reads the bytes as the system code
 * page and every Arabic product name arrives as mojibake.
 */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The report as rows: a header block, the products, then the totals. */
export function reportCsv(r: ReportPayload, lang: string): (string | number | null)[][] {
  const ar = lang === 'ar'
  const n = (v: number, d = 2) => Number(v.toFixed(d))

  const rows: (string | number | null)[][] = [
    [ar ? 'تقرير Bakex' : 'Bakex report'],
    [ar ? 'الفترة' : 'Period', r.range.from, r.range.to],
    [ar ? 'فترة المقارنة' : 'Compared with', r.range.prev.from, r.range.prev.to],
    [],
    [
      ar ? 'المنتج' : 'Product',
      ar ? 'كوست الوحدة' : 'Unit cost',
      ar ? 'سعر البيع' : 'Sell price',
      ar ? 'الكمية المباعة' : 'Qty sold',
      ar ? 'الكمية السابقة' : 'Prev qty',
      ar ? 'الإيراد' : 'Revenue',
      ar ? 'التكلفة' : 'Cost',
      ar ? 'الربح' : 'Profit',
      ar ? 'الهامش %' : 'Margin %',
      ar ? 'الحصة %' : 'Share %',
    ],
  ]

  for (const d of r.data) {
    rows.push([
      d.name, n(d.unitCost, 3), n(d.sellPrice), d.qty, d.prevQty,
      n(d.revenue), n(d.cost), n(d.profit),
      d.margin === null ? null : n(d.margin, 1), n(d.share, 1),
    ])
  }

  rows.push([])
  rows.push([ar ? 'الإجمالي' : 'Total', '', '', r.totals.unitsSold, '', n(r.totals.revenue), n(r.totals.cost), n(r.totals.profit), n(r.totals.avgMargin, 1), 100])
  rows.push([ar ? 'مصروف الشراء' : 'Purchase spend', n(r.totals.purchaseCost)])
  rows.push([])
  rows.push([ar ? 'الفترة السابقة' : 'Previous period', '', '', '', '', n(r.previous.revenue), n(r.previous.cost), n(r.previous.profit)])

  if (r.prodSummary.length) {
    rows.push([])
    rows.push([ar ? 'الإنتاج' : 'Production', ar ? 'الكمية' : 'Qty', ar ? 'الوحدة' : 'Unit', ar ? 'التكلفة' : 'Cost'])
    for (const p of r.prodSummary) rows.push([p.recipe_name, p.total, p.output_unit, n(p.totalCost)])
  }

  return rows
}
