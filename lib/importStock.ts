import { toSheet, parseNumber, normaliseHeader, type Sheet } from './csvParse'

/**
 * Turning somebody's materials spreadsheet into stock rows.
 *
 * A bakery arrives with its inventory already written down, and typing a
 * hundred materials in by hand is the reason a trial ends without the product
 * ever being used. Nothing here writes to the database: it reads a sheet,
 * decides what each column is, and reports every row it could and could not
 * make sense of, so the user sees the result before agreeing to it.
 *
 * The same validation runs again on the server. This half exists to show
 * people their mistakes, not to be trusted.
 */

export const STOCK_FIELDS = ['name', 'unit', 'qty', 'min_qty', 'price_per_unit'] as const
export type StockField = (typeof STOCK_FIELDS)[number]

/** One import is a setup step, not a data feed. */
export const MAX_IMPORT_ROWS = 2000

export const FIELD_LABELS: Record<StockField, { ar: string; en: string }> = {
  name:           { ar: 'اسم المادة',      en: 'Material' },
  unit:           { ar: 'الوحدة',          en: 'Unit' },
  qty:            { ar: 'الكمية',          en: 'Quantity' },
  min_qty:        { ar: 'الحد الأدنى',     en: 'Minimum' },
  price_per_unit: { ar: 'سعر الوحدة',      en: 'Unit price' },
}

/**
 * What a column might be called. Matched after normaliseHeader, so these are
 * written without diacritics and with the alef and ta-marbuta already folded —
 * "الحد الأدنى" arrives here as "الحد الادني".
 */
const SYNONYMS: Record<StockField, string[]> = {
  name: ['اسم', 'الاسم', 'اسم الماده', 'الماده', 'ماده', 'الصنف', 'صنف', 'المنتج', 'البند',
         'name', 'item', 'material', 'product', 'ingredient', 'description'],
  unit: ['وحده', 'الوحده', 'وحده القياس', 'القياس', 'unit', 'units', 'uom', 'measure'],
  qty: ['كميه', 'الكميه', 'الرصيد', 'رصيد', 'المخزون', 'المتوفر', 'الموجود',
        'qty', 'quantity', 'stock', 'balance', 'on hand', 'onhand', 'count'],
  min_qty: ['الحد الادني', 'حد الادني', 'اقل كميه', 'حد الطلب', 'نقطه الطلب', 'الحد',
            'min', 'min qty', 'minimum', 'reorder', 'reorder point', 'safety stock'],
  price_per_unit: ['السعر', 'سعر', 'سعر الوحده', 'سعر الشراء', 'التكلفه', 'تكلفه', 'الكلفه',
                   'price', 'unit price', 'cost', 'unit cost', 'rate'],
}

/** Column order assumed when the sheet has no header row at all. */
const POSITIONAL: StockField[] = ['name', 'unit', 'qty', 'min_qty', 'price_per_unit']

export type Mapping = Partial<Record<StockField, number>>

/**
 * Works out which column holds which field.
 *
 * An exact synonym wins over a partial one, so a sheet with both "سعر الوحدة"
 * and "الوحدة" does not put the price into the unit column.
 */
export function detectMapping(header: string[]): Mapping {
  const mapping: Mapping = {}
  if (header.length === 0) {
    POSITIONAL.forEach((f, i) => { mapping[f] = i })
    return mapping
  }

  const normalised = header.map(normaliseHeader)
  const taken = new Set<number>()

  const claim = (field: StockField, test: (h: string, syn: string) => boolean) => {
    if (mapping[field] !== undefined) return
    for (let i = 0; i < normalised.length; i++) {
      if (taken.has(i) || !normalised[i]) continue
      if (SYNONYMS[field].some(syn => test(normalised[i], syn))) {
        mapping[field] = i
        taken.add(i)
        return
      }
    }
  }

  for (const f of STOCK_FIELDS) claim(f, (h, syn) => h === syn)
  for (const f of STOCK_FIELDS) claim(f, (h, syn) => h.includes(syn) || syn.includes(h))

  // A sheet whose headers are in a language we do not recognise still has a
  // first column, and it is almost always the name.
  if (mapping.name === undefined) {
    const free = normalised.findIndex((_, i) => !taken.has(i))
    if (free >= 0) mapping.name = free
  }
  return mapping
}

export interface ImportIssue {
  /** 1-based line in the user's sheet, counting the header. */
  line: number
  field?: StockField
  message: string
}

export interface StockRow {
  line: number
  name: string
  unit: string
  qty: number
  min_qty: number
  price_per_unit: number
}

export interface ImportPreview {
  sheet: Sheet
  mapping: Mapping
  rows: StockRow[]
  issues: ImportIssue[]
  /** Names appearing more than once in the file; the last one wins. */
  duplicates: string[]
  /** True when the sheet was longer than MAX_IMPORT_ROWS and was cut. */
  truncated: boolean
}

const cell = (row: string[], i: number | undefined) =>
  i === undefined || i < 0 || i >= row.length ? '' : (row[i] ?? '').trim()

/**
 * A number column that is blank means zero — a bakery listing materials it has
 * not counted yet should not have to type 0 in every cell. A column with
 * something unreadable in it is an error, because guessing there would put a
 * wrong price on a material and quietly wrong costs on every recipe using it.
 */
function readNumber(
  raw: string, field: StockField, line: number, issues: ImportIssue[]
): number {
  if (raw === '') return 0
  const n = parseNumber(raw)
  if (n === null) {
    issues.push({ line, field, message: `"${raw}" ليس رقماً` })
    return 0
  }
  if (n < 0) {
    issues.push({ line, field, message: `القيمة سالبة (${n})` })
    return 0
  }
  return n
}

export function buildPreview(input: string, override?: Mapping, delimiter?: string): ImportPreview {
  const sheet = toSheet(input, delimiter)
  const mapping = { ...detectMapping(sheet.header), ...(override ?? {}) }
  const headerOffset = sheet.header.length > 0 ? 2 : 1

  const issues: ImportIssue[] = []
  const truncated = sheet.rows.length > MAX_IMPORT_ROWS
  const source = truncated ? sheet.rows.slice(0, MAX_IMPORT_ROWS) : sheet.rows

  const byName = new Map<string, StockRow>()
  const duplicates: string[] = []

  source.forEach((raw, i) => {
    const line = i + headerOffset
    const name = cell(raw, mapping.name).slice(0, 200)

    if (!name) {
      issues.push({ line, field: 'name', message: 'لا يوجد اسم للمادة' })
      return
    }

    const row: StockRow = {
      line,
      name,
      unit: cell(raw, mapping.unit).slice(0, 50),
      qty: readNumber(cell(raw, mapping.qty), 'qty', line, issues),
      min_qty: readNumber(cell(raw, mapping.min_qty), 'min_qty', line, issues),
      price_per_unit: readNumber(cell(raw, mapping.price_per_unit), 'price_per_unit', line, issues),
    }

    // The database has a unique index on (bakery_id, name), so a file that
    // names the same material twice would fail the whole import halfway
    // through. Collapsing it here — last one wins — keeps that from happening
    // and tells the user which names it happened to.
    if (byName.has(name)) duplicates.push(name)
    byName.set(name, row)
  })

  if (truncated) {
    issues.push({
      line: MAX_IMPORT_ROWS + headerOffset,
      message: `تم أخذ أول ${MAX_IMPORT_ROWS} صف فقط`,
    })
  }

  return {
    sheet,
    mapping,
    rows: Array.from(byName.values()),
    issues,
    duplicates: Array.from(new Set(duplicates)),
    truncated,
  }
}
