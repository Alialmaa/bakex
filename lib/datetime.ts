/**
 * Locale-aware date/time formatting for the whole app.
 *
 * Arabic uses `ar-u-ca-gregory-nu-latn` — Arabic month/day names, but the
 * Gregorian calendar and Latin digits. Plain `ar-SA` would render Hijri dates
 * in Arabic-Indic digits, which (a) clashes with the Latin figures used in
 * every table and metric, and (b) differs between the Node server and the
 * browser, producing hydration mismatches.
 */
export const AR_DATE_LOCALE = 'ar-u-ca-gregory-nu-latn'

export const dateLocale = (lang: string) => (lang === 'ar' ? AR_DATE_LOCALE : 'en')

type Input = string | number | Date

const toDate = (v: Input) => (v instanceof Date ? v : new Date(v))

export function fmtDate(v: Input, lang: string, opts?: Intl.DateTimeFormatOptions) {
  return toDate(v).toLocaleDateString(dateLocale(lang), opts)
}

export function fmtTime(v: Input, lang: string, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) {
  return toDate(v).toLocaleTimeString(dateLocale(lang), opts)
}

/** Long form, e.g. "السبت، 25 يوليو 2026" / "Saturday, July 25, 2026". */
export function fmtDateLong(v: Input, lang: string) {
  return fmtDate(v, lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** A plain `YYYY-MM-DD` read as local noon, so timezone shifts can't move the day. */
export const fromDayString = (day: string) => new Date(day + 'T12:00:00')
