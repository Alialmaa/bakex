import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db, resetDb, seed } from './support/db'
import { signToken, invalidateUserCache } from '../lib/auth'
import { invalidateSubscriptionCache } from '../lib/subscription'
import { parseNumber, normaliseNumeral, parseDelimited, detectDelimiter, toSheet, normaliseHeader } from '../lib/csvParse'
import { detectMapping, buildPreview, MAX_IMPORT_ROWS } from '../lib/importStock'
import handler from '../pages/api/stock/import'

/**
 * A real materials sheet is not clean. It comes out of an Arabic Excel with
 * Arabic-Indic digits, a BOM, semicolons instead of commas, prices written with
 * thousands separators and a currency symbol, and at least one material typed
 * twice. Everything here is a shape that has to survive.
 */

describe('normaliseNumeral', () => {
  test('reads Arabic-Indic digits', () => {
    assert.equal(parseNumber('٢٥٠'), 250)
    assert.equal(parseNumber('٤٫٥'), 4.5)      // Arabic decimal separator
    assert.equal(parseNumber('١٬٢٥٠٫٥'), 1250.5) // and its thousands separator
  })

  test('reads Eastern Arabic-Indic digits', () => {
    assert.equal(parseNumber('۳۵'), 35)
  })

  test('strips a currency symbol and the marks around it', () => {
    assert.equal(parseNumber('4.50 ر.س'), 4.5)
    assert.equal(parseNumber('SAR 12'), 12)
    assert.equal(parseNumber('‏٧٫٢٥‎'), 7.25)
  })

  test('a comma before exactly three digits is grouping, not a decimal', () => {
    assert.equal(parseNumber('1,250'), 1250)
    assert.equal(parseNumber('12,500'), 12500)
  })

  test('a comma before one or two digits is a decimal', () => {
    // A German or French sheet writes 4,5 for four and a half.
    assert.equal(parseNumber('4,5'), 4.5)
    assert.equal(parseNumber('4,50'), 4.5)
  })

  test('whichever separator comes last is the decimal one', () => {
    assert.equal(parseNumber('1,250.75'), 1250.75)
    assert.equal(parseNumber('1.250,75'), 1250.75)
  })

  test('a lone dot is a decimal point unless there are several', () => {
    assert.equal(parseNumber('1.250'), 1.25)
    assert.equal(parseNumber('1.250.500'), 1250500)
  })

  test('refuses text rather than guessing a number out of it', () => {
    for (const junk of ['', '   ', 'كجم', 'n/a', '-', 'abc', '١٢أ٣']) {
      assert.equal(parseNumber(junk), null, junk)
    }
  })

  test('normaliseNumeral leaves nothing but digits and a point', () => {
    assert.equal(normaliseNumeral('١٬٢٥٠٫٥٠ ر.س'), '1250.50')
  })
})

describe('parseDelimited', () => {
  test('splits plain rows', () => {
    assert.deepEqual(parseDelimited('a,b\n1,2'), [['a', 'b'], ['1', '2']])
  })

  test('a quoted field keeps its delimiter', () => {
    assert.deepEqual(parseDelimited('"دقيق, أبيض",كجم'), [['دقيق, أبيض', 'كجم']])
  })

  test('a doubled quote is one quote, not the end of the field', () => {
    assert.deepEqual(parseDelimited('"قال ""مرحبا""",x'), [['قال "مرحبا"', 'x']])
  })

  test('a newline inside a quoted field does not start a row', () => {
    assert.deepEqual(parseDelimited('"سطر\nثاني",2'), [['سطر\nثاني', '2']])
  })

  test('drops the BOM Excel writes, so the first header is not "\\ufeffname"', () => {
    const rows = parseDelimited('﻿name,qty\nدقيق,5')
    assert.equal(rows[0][0], 'name')
  })

  test('handles CRLF without leaving a stray carriage return', () => {
    assert.deepEqual(parseDelimited('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']])
  })

  test('ignores blank lines and lines of empty cells', () => {
    assert.deepEqual(parseDelimited('a,b\n\n1,2\n,,\n'), [['a', 'b'], ['1', '2']])
  })
})

describe('detectDelimiter', () => {
  test('tab means it was pasted from a spreadsheet', () => {
    assert.equal(detectDelimiter('name\tqty\tunit\n'), '\t')
  })

  test('semicolon, which is what an Excel with a comma decimal writes', () => {
    assert.equal(detectDelimiter('name;qty;price\nدقيق;5;4,50'), ';')
  })

  test('falls back to a comma when there is nothing to go on', () => {
    assert.equal(detectDelimiter('name'), ',')
  })

  test('a semicolon file with commas inside numbers still parses per column', () => {
    const rows = parseDelimited('اسم;كمية;سعر\nدقيق;5;4,50')
    assert.deepEqual(rows[1], ['دقيق', '5', '4,50'])
    assert.equal(parseNumber(rows[1][2]), 4.5)
  })
})

describe('toSheet', () => {
  test('takes the first line as a header when it is made of words', () => {
    const s = toSheet('اسم المادة,الوحدة,الكمية\nدقيق,كجم,50')
    assert.deepEqual(s.header, ['اسم المادة', 'الوحدة', 'الكمية'])
    assert.equal(s.rows.length, 1)
  })

  test('a sheet pasted without a header does not lose its first material', () => {
    // Half or more numeric cells means these are values, not labels.
    const s = toSheet('دقيق,كجم,50,10,4.5\nسكر,كجم,30,5,3')
    assert.deepEqual(s.header, [])
    assert.equal(s.rows.length, 2)
    assert.equal(s.rows[0][0], 'دقيق')
  })
})

describe('normaliseHeader', () => {
  test('folds the alef and ta-marbuta variants people type inconsistently', () => {
    assert.equal(normaliseHeader('الحد الأدنى'), 'الحد الادني')
    assert.equal(normaliseHeader('الكمية'), 'الكميه')
    assert.equal(normaliseHeader('إسم المادة'), 'اسم الماده')
  })

  test('strips diacritics, tatweel and stray punctuation', () => {
    assert.equal(normaliseHeader('  سِعــر_الوحدة '), 'سعر الوحده')
  })
})

describe('detectMapping', () => {
  test('finds every column of an Arabic header', () => {
    const m = detectMapping(['اسم المادة', 'الوحدة', 'الكمية', 'الحد الأدنى', 'سعر الوحدة'])
    assert.deepEqual(m, { name: 0, unit: 1, qty: 2, min_qty: 3, price_per_unit: 4 })
  })

  test('finds every column of an English header, in any order', () => {
    const m = detectMapping(['Price', 'Item', 'On hand', 'UoM', 'Reorder'])
    assert.equal(m.name, 1)
    assert.equal(m.qty, 2)
    assert.equal(m.unit, 3)
    assert.equal(m.min_qty, 4)
    assert.equal(m.price_per_unit, 0)
  })

  test('an exact match wins, so "سعر الوحدة" does not claim the unit column', () => {
    const m = detectMapping(['سعر الوحدة', 'الوحدة'])
    assert.equal(m.price_per_unit, 0)
    assert.equal(m.unit, 1)
  })

  test('a headerless sheet is read positionally', () => {
    assert.deepEqual(detectMapping([]), { name: 0, unit: 1, qty: 2, min_qty: 3, price_per_unit: 4 })
  })

  test('an unrecognised header still gets a name column', () => {
    // Better to import the materials under the wrong-looking heading than to
    // refuse the file; every column is changeable in the dialog anyway.
    const m = detectMapping(['Artikel', 'Menge'])
    assert.equal(m.name, 0)
  })
})

describe('buildPreview', () => {
  const SHEET = [
    'اسم المادة,الوحدة,الكمية,الحد الأدنى,سعر الوحدة',
    'دقيق,كجم,٥٠,10,"4,50"',
    'سكر,كجم,30,5,3.25',
    'زبدة,كجم,,2,"1,250"',
  ].join('\n')

  test('reads a whole sheet, digits and separators and all', () => {
    const p = buildPreview(SHEET)
    assert.equal(p.rows.length, 3)
    assert.deepEqual(
      p.rows.map(r => [r.name, r.unit, r.qty, r.min_qty, r.price_per_unit]),
      [['دقيق', 'كجم', 50, 10, 4.5], ['سكر', 'كجم', 30, 5, 3.25], ['زبدة', 'كجم', 0, 2, 1250]]
    )
    assert.equal(p.issues.length, 0)
  })

  test('a blank number is zero, not an error', () => {
    const p = buildPreview(SHEET)
    assert.equal(p.rows.find(r => r.name === 'زبدة')!.qty, 0)
  })

  test('a number it cannot read is an error, not a guess', () => {
    // Guessing here would put a wrong price on a material and quietly wrong
    // costs on every recipe that uses it.
    const p = buildPreview('اسم,سعر\nدقيق,غالي')
    assert.equal(p.issues.length, 1)
    assert.equal(p.issues[0].field, 'price_per_unit')
    assert.equal(p.rows[0].price_per_unit, 0)
  })

  test('a row with no name is reported and dropped', () => {
    const p = buildPreview('اسم,كمية\n,5\nسكر,3')
    assert.equal(p.rows.length, 1)
    assert.equal(p.issues[0].field, 'name')
  })

  test('reports the line number as the user sees it in the sheet', () => {
    const p = buildPreview('اسم,كمية\nدقيق,5\n,7')
    // Header is line 1, so the offending row is line 3.
    assert.equal(p.issues[0].line, 3)
  })

  test('a repeated name is collapsed, last row winning, and named', () => {
    const p = buildPreview('اسم,كمية\nدقيق,5\nسكر,3\nدقيق,99')
    assert.equal(p.rows.length, 2)
    assert.equal(p.rows.find(r => r.name === 'دقيق')!.qty, 99)
    assert.deepEqual(p.duplicates, ['دقيق'])
  })

  test('a negative quantity is refused rather than imported', () => {
    const p = buildPreview('اسم,كمية\nدقيق,-5')
    assert.equal(p.rows[0].qty, 0)
    assert.ok(p.issues.some(i => i.field === 'qty'))
  })

  test('an override replaces the column it guessed', () => {
    const p = buildPreview('اسم,كمية,سعر\nدقيق,5,3', { qty: 2 })
    assert.equal(p.rows[0].qty, 3)
  })

  test('a column mapped to nothing leaves its field at zero', () => {
    const p = buildPreview('اسم,كمية\nدقيق,5', { qty: -1 })
    assert.equal(p.rows[0].qty, 0)
  })

  test('caps an enormous sheet and says so', () => {
    const big = ['اسم,كمية', ...Array.from({ length: MAX_IMPORT_ROWS + 50 }, (_, i) => `مادة${i},1`)].join('\n')
    const p = buildPreview(big)
    assert.equal(p.truncated, true)
    assert.equal(p.rows.length, MAX_IMPORT_ROWS)
  })

  test('pasted tab-separated cells work exactly like a file', () => {
    const p = buildPreview('اسم المادة\tالوحدة\tالكمية\nدقيق\tكجم\t50')
    assert.equal(p.rows[0].name, 'دقيق')
    assert.equal(p.rows[0].qty, 50)
  })

  test('empty input is an empty preview, not a crash', () => {
    const p = buildPreview('')
    assert.deepEqual(p.rows, [])
    assert.deepEqual(p.issues, [])
  })
})

// ─── the route ──────────────────────────────────────────────

const ADMIN = {
  id: 'u-admin', token_version: 1, status: 'active',
  role: 'admin', perms: { stock: true }, bakery_id: 'b1', name: 'علي',
}

const token = (over: any = {}) => signToken({
  id: ADMIN.id, tv: ADMIN.token_version, role: ADMIN.role,
  perms: ADMIN.perms, bakery_id: ADMIN.bakery_id, ...over,
})

function mock(body: any, method = 'POST', tok = token()) {
  const req: any = { method, headers: { cookie: `bakex_token=${tok}` }, body, query: {} }
  const res: any = {
    code: 200, body: null, headers: {},
    status(c: number) { res.code = c; return res },
    json(b: any) { res.body = b; return res },
    end() { return res },
    setHeader(k: string, v: any) { res.headers[k] = v; return res },
  }
  return { req, res }
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

beforeEach(() => {
  resetDb()
  invalidateUserCache(ADMIN.id)
  invalidateSubscriptionCache('b1')
  seed('users', [{ ...ADMIN }])
  seed('bakeries', [{ id: 'b1', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(90) }])
  seed('stock', [{ id: 's1', bakery_id: 'b1', name: 'دقيق', unit: 'كجم', qty: 10, min_qty: 2, price_per_unit: 4 }])
  seed('audit_log', [])
})

describe('POST /api/stock/import', () => {
  test('adds the materials that are new', async () => {
    const { req, res } = mock({ rows: [{ name: 'سكر', unit: 'كجم', qty: 30, min_qty: 5, price_per_unit: 3 }] })
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.deepEqual(res.body, { added: 1, updated: 0, skipped: 0, total: 1 })
    const sugar = db().tables['stock'].find((s: any) => s.name === 'سكر')
    assert.equal(sugar.qty, 30)
    assert.equal(sugar.bakery_id, 'b1')
  })

  test('updates a material that already exists', async () => {
    const { req, res } = mock({ rows: [{ name: 'دقيق', unit: 'كجم', qty: 99, min_qty: 7, price_per_unit: 5 }] })
    await handler(req, res)
    assert.deepEqual(res.body, { added: 0, updated: 1, skipped: 0, total: 1 })
    assert.equal(db().tables['stock'].find((s: any) => s.name === 'دقيق').qty, 99)
  })

  test('skip mode leaves what is there alone', async () => {
    const { req, res } = mock({
      mode: 'skip',
      rows: [{ name: 'دقيق', qty: 99 }, { name: 'سكر', qty: 30 }],
    })
    await handler(req, res)
    assert.deepEqual(res.body, { added: 1, updated: 0, skipped: 1, total: 2 })
    assert.equal(db().tables['stock'].find((s: any) => s.name === 'دقيق').qty, 10, 'untouched')
  })

  test('never deletes: a material absent from the file survives', async () => {
    // An import is not a sync, and a customer's first upload is often partial.
    const { req, res } = mock({ rows: [{ name: 'سكر', qty: 1 }] })
    await handler(req, res)
    assert.ok(db().tables['stock'].some((s: any) => s.name === 'دقيق'))
  })

  test('writes only the columns it names', async () => {
    const { req, res } = mock({
      rows: [{ name: 'سكر', qty: 1, bakery_id: 'someone-else', id: 'forged', total: 999 }],
    })
    await handler(req, res)
    const sugar = db().tables['stock'].find((s: any) => s.name === 'سكر')
    assert.equal(sugar.bakery_id, 'b1', 'the bakery comes from the session, not the payload')
    assert.ok(!('total' in sugar))
  })

  test('a repeated name in one request does not break the batch', async () => {
    const { req, res } = mock({ rows: [{ name: 'سكر', qty: 1 }, { name: 'سكر', qty: 7 }] })
    await handler(req, res)
    assert.equal(res.code, 200)
    const rows = db().tables['stock'].filter((s: any) => s.name === 'سكر')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].qty, 7, 'last one wins')
  })

  test('coerces a hostile number rather than storing it', async () => {
    const { req, res } = mock({ rows: [{ name: 'سكر', qty: -5, price_per_unit: 'NaN', min_qty: Infinity }] })
    await handler(req, res)
    const sugar = db().tables['stock'].find((s: any) => s.name === 'سكر')
    assert.equal(sugar.qty, 0)
    assert.equal(sugar.price_per_unit, 0)
    assert.equal(sugar.min_qty, 0)
  })

  test('rejects a body that is not a list of rows', async () => {
    for (const bad of [{}, { rows: 'دقيق' }, { rows: [] }]) {
      const { req, res } = mock(bad)
      await handler(req, res)
      assert.equal(res.code, 400, JSON.stringify(bad))
    }
  })

  test('rejects a sheet past the cap instead of trying it', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ name: `م${i}`, qty: 1 }))
    const { req, res } = mock({ rows })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('rejects rows that have no name at all', async () => {
    const { req, res } = mock({ rows: [{ qty: 5 }, { name: '   ' }] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('a user without the stock permission cannot import', async () => {
    invalidateUserCache('u-view')
    seed('users', [{ ...ADMIN }, { id: 'u-view', token_version: 1, status: 'active', role: 'readonly', perms: { stock: false }, bakery_id: 'b1' }])
    const { req, res } = mock(
      { rows: [{ name: 'سكر', qty: 1 }] }, 'POST',
      signToken({ id: 'u-view', tv: 1, role: 'readonly', perms: { stock: false }, bakery_id: 'b1' })
    )
    await handler(req, res)
    assert.equal(res.code, 403)
    assert.ok(!db().tables['stock'].some((s: any) => s.name === 'سكر'))
  })

  test('GET is not a way in', async () => {
    const { req, res } = mock({ rows: [] }, 'GET')
    await handler(req, res)
    assert.equal(res.code, 405)
  })

  test('leaves an audit entry saying what it did', async () => {
    const { req, res } = mock({ rows: [{ name: 'سكر', qty: 1 }, { name: 'دقيق', qty: 2 }] })
    await handler(req, res)
    const entry = db().tables['audit_log'][0]
    assert.equal(entry.action, 'stock.import')
    assert.equal(entry.bakery_id, 'b1')
    assert.equal(entry.details.added, 1)
    assert.equal(entry.details.updated, 1)
  })

  test('a sheet parsed in the browser survives the round trip intact', async () => {
    const preview = buildPreview([
      'اسم المادة;الوحدة;الكمية;الحد الأدنى;سعر الوحدة',
      'سكر;كجم;٣٠;٥;"3,25"',
      'زبدة;كجم;12;2;"1.250,50"',
    ].join('\n'))
    const { req, res } = mock({ rows: preview.rows })
    await handler(req, res)
    assert.equal(res.body.added, 2)
    const butter = db().tables['stock'].find((s: any) => s.name === 'زبدة')
    assert.equal(butter.price_per_unit, 1250.5)
    assert.equal(db().tables['stock'].find((s: any) => s.name === 'سكر').price_per_unit, 3.25)
  })
})
