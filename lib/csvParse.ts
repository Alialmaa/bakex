/**
 * Reading a spreadsheet without a spreadsheet library.
 *
 * There is no xlsx dependency here on purpose: the parsers are large, they have
 * a poor security record for something that reads untrusted files, and the two
 * routes that actually matter need none of it —
 *
 *   * a `.csv` saved out of Excel, and
 *   * cells copied from Excel and pasted, which arrive on the clipboard as
 *     tab-separated text.
 *
 * Both are plain delimited text, so one parser covers them. The awkward parts
 * are not the format but the locale: an Arabic Excel writes ٢٥٠٫٥ with
 * Arabic-Indic digits and an Arabic decimal separator, wraps numbers in
 * thousands separators, and prefixes the file with a UTF-8 BOM.
 */

/** Excel writes a BOM so it can recognise its own UTF-8 files; it is not data. */
const BOM = '﻿'

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'

/**
 * Turns any digits into ASCII ones and normalises the separators.
 *
 * `٢٥٠٫٥٠` and `1,250.50` and `1.250,50` all have to become numbers. The last
 * pair is genuinely ambiguous — `1.250` is a thousand and a quarter in Germany
 * and one-and-a-quarter almost everywhere else — so the rule is positional:
 * whichever of `.` or `,` appears last is the decimal separator, and the other
 * is grouping. A single separator with exactly three digits after it is read as
 * grouping, since `1,250` is far more likely to be a price than 1.25.
 */
export function normaliseNumeral(raw: string): string {
  let s = raw.trim()
  if (!s) return ''

  // Digits first, so the separator logic below sees ASCII.
  s = s.replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)))
       .replace(/[۰-۹]/g, d => String(EASTERN_ARABIC_INDIC.indexOf(d)))

  // Arabic decimal separator and thousands separator.
  s = s.replace(/٫/g, '.').replace(/٬/g, ',')
  // Spaces and bidi marks are formatting, never content.
  s = s.replace(/[\s\u00a0\u200e\u200f\u061c]/g, '')

  // The sign is kept aside so trimming cannot eat it.
  const sign = /^[+-]/.test(s) ? s[0] : ''
  let body = sign ? s.slice(1) : s

  // Currency and units are trimmed from the ends only. Stripping every
  // non-digit anywhere would turn "ر.س" into a stray decimal point — "4.50 ر.س"
  // became "4.50." — and would silently weld "١٢أ٣" into 123 rather than
  // rejecting it.
  body = body.replace(/^[^\d]+/, '').replace(/[^\d]+$/, '')
  if (!/^[\d.,]*$/.test(body)) return ''
  s = body
  if (!s) return ''

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ','
    const grouping = decimal === '.' ? ',' : '.'
    s = s.split(grouping).join('')
    if (decimal === ',') s = s.replace(',', '.')
  } else if (lastComma >= 0) {
    // A lone comma: grouping when it is followed by exactly three digits.
    s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1
    // The same rule for dots, but only when there is more than one of them —
    // `1.250` alone is far more often 1.25 than 1250 outside Europe.
    if (after === 3 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '')
  }

  return sign + s
}

/** The number a cell means, or null when it does not mean one. */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const s = normaliseNumeral(raw)
  if (!s || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Guesses the delimiter from the first line.
 *
 * A tab means the text was pasted from a spreadsheet. A semicolon means a CSV
 * written by an Excel whose locale uses the comma as a decimal separator, which
 * is exactly the file most likely to arrive here.
 */
export function detectDelimiter(text: string): string {
  const line = text.slice(0, text.search(/\r?\n/) + 1 || text.length)
  const counts: Record<string, number> = {
    '\t': (line.match(/\t/g) || []).length,
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

/**
 * Splits delimited text into rows of cells.
 *
 * Hand-written rather than a regex because of quoting: a quoted field may
 * contain the delimiter, a newline, or an escaped quote (`""`), and none of
 * those can be handled by splitting.
 */
export function parseDelimited(input: string, delimiter?: string): string[][] {
  let text = input.startsWith(BOM) ? input.slice(1) : input
  // Normalise line endings so a row never ends with a stray \r.
  text = text.replace(/\r\n?/g, '\n')
  const delim = delimiter ?? detectDelimiter(text)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else {
        field += c
      }
      continue
    }

    if (c === '"' && field === '') { quoted = true; continue }
    if (c === delim) { row.push(field); field = ''; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }

  // Whatever is left is the last row, unless the file ended with a newline.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }

  // Trailing blank lines are not rows, and neither is a line of empty cells.
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

export interface Sheet {
  header: string[]
  rows: string[][]
}

/**
 * Splits the parsed grid into a header and its rows.
 *
 * The first non-empty line is the header only when it looks like one — a row of
 * labels rather than of values. A sheet pasted without its header would
 * otherwise lose its first material.
 */
export function toSheet(input: string, delimiter?: string): Sheet {
  const grid = parseDelimited(input, delimiter)
  if (grid.length === 0) return { header: [], rows: [] }

  const first = grid[0]
  const numericCells = first.filter(c => c.trim() !== '' && parseNumber(c) !== null).length
  const filled = first.filter(c => c.trim() !== '').length
  // A header row is mostly words. Half or more numbers means these are values.
  const looksLikeHeader = filled > 0 && numericCells * 2 < filled

  return looksLikeHeader
    ? { header: first.map(h => h.trim()), rows: grid.slice(1) }
    : { header: [], rows: grid }
}

/** Strips the marks and spacing that make two identical-looking headers differ. */
export function normaliseHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    // Arabic diacritics and the tatweel used for justification.
    .replace(/[ً-ْـ]/g, '')
    // alef variants, ta marbuta, alef maqsura — all typed inconsistently.
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
