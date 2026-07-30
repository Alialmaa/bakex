/**
 * The period a report covers, and the period it is compared against.
 *
 * Everything here is UTC. migrations/004 cuts days in UTC on purpose — the
 * comment on `sales_daily_totals` explains why — and every date the app sends
 * comes from toISOString(), so doing the arithmetic in local time here would
 * shift the boundaries against the database by three hours in Riyadh and change
 * figures users have already seen.
 *
 * Dates are bare `YYYY-MM-DD` and both ends are inclusive, because that is what
 * a person means by "1 July to 31 July". The aggregates compare a timestamptz
 * with `>= p_from AND <= p_to`, so the bounds are widened to the first and last
 * instant of those days by fromBound/toBound rather than by the caller.
 */

export const PRESETS = ['today', 'week', 'month', 'quarter', 'year'] as const
export type Preset = (typeof PRESETS)[number] | 'custom'

export interface ResolvedRange {
  preset: Preset
  /** Inclusive, `YYYY-MM-DD`. */
  from: string
  /** Inclusive, `YYYY-MM-DD`. */
  to: string
  /** Length in days, inclusive of both ends. */
  days: number
  /**
   * The comparable earlier window. For a calendar preset this is the same
   * stretch of the previous month, quarter or year — "the first 12 days of
   * June" against "the first 12 days of July" — not merely the 12 days before
   * the 1st, which would compare a month's start against a month's end.
   */
  prev: { from: string; to: string }
}

const DAY = 86_400_000
const ISO = /^\d{4}-\d{2}-\d{2}$/

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const ms = (d: string) => Date.parse(`${d}T00:00:00.000Z`)

/** Widened to the whole day, so `to` really includes what happened on that date. */
export const fromBound = (d: string) => `${d}T00:00:00.000Z`
export const toBound = (d: string) => `${d}T23:59:59.999Z`

const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY) + 1

/** Day count of the month `y-m` (m is 0-based), used to clamp a short previous month. */
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

function startOfMonth(y: number, m: number) {
  return iso(Date.UTC(y, m, 1))
}

/**
 * Same offset into the previous period, clipped to that period's length.
 *
 * Month-to-date on 31 March has no 31st to compare against in February; the
 * comparison window ends on the 28th instead of silently rolling into March.
 */
function sameStretch(prevStart: string, days: number, prevPeriodDays: number) {
  const span = Math.min(days, prevPeriodDays)
  return { from: prevStart, to: iso(ms(prevStart) + (span - 1) * DAY) }
}

/** The window of the same length immediately before `from`. */
function slidingPrev(from: string, days: number) {
  const to = iso(ms(from) - DAY)
  return { from: iso(ms(to) - (days - 1) * DAY), to }
}

export function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && ISO.test(d) && !Number.isNaN(ms(d))
}

export interface RangeInput {
  preset?: string | string[]
  from?: string | string[]
  to?: string | string[]
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * Turns whatever the query string carried into a range, falling back to
 * month-to-date — the period the page has always shown — rather than erroring.
 * A custom range is capped at two years so one URL cannot ask the database to
 * aggregate a decade.
 */
export function resolveRange(input: RangeInput = {}, now: Date = new Date()): ResolvedRange {
  const today = iso(now.getTime())
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  const rawPreset = first(input.preset)
  const rawFrom = first(input.from)
  const rawTo = first(input.to)

  if (rawPreset === 'custom' || (!rawPreset && isValidDate(rawFrom))) {
    if (isValidDate(rawFrom) && isValidDate(rawTo) && ms(rawFrom) <= ms(rawTo)) {
      const capped = Math.min(daysBetween(rawFrom, rawTo), 731)
      const to = iso(ms(rawFrom) + (capped - 1) * DAY)
      const days = daysBetween(rawFrom, to)
      return { preset: 'custom', from: rawFrom, to, days, prev: slidingPrev(rawFrom, days) }
    }
    // Fall through to the default rather than showing an empty report for a
    // range the user cannot see or correct.
  }

  const preset: Preset = (PRESETS as readonly string[]).includes(rawPreset as string)
    ? (rawPreset as Preset)
    : 'month'

  if (preset === 'today') {
    return { preset, from: today, to: today, days: 1, prev: slidingPrev(today, 1) }
  }

  if (preset === 'week') {
    const from = iso(ms(today) - 6 * DAY)
    return { preset, from, to: today, days: 7, prev: slidingPrev(from, 7) }
  }

  if (preset === 'quarter') {
    const qStartMonth = Math.floor(m / 3) * 3
    const from = startOfMonth(y, qStartMonth)
    const days = daysBetween(from, today)
    const prevQStart = startOfMonth(y, qStartMonth - 3)
    const prevQDays = [0, 1, 2].reduce((s, i) => {
      const d = new Date(Date.UTC(y, qStartMonth - 3 + i, 1))
      return s + lastDayOf(d.getUTCFullYear(), d.getUTCMonth())
    }, 0)
    return { preset, from, to: today, days, prev: sameStretch(prevQStart, days, prevQDays) }
  }

  if (preset === 'year') {
    const from = iso(Date.UTC(y, 0, 1))
    const days = daysBetween(from, today)
    const prevStart = iso(Date.UTC(y - 1, 0, 1))
    const prevYearDays = daysBetween(prevStart, iso(Date.UTC(y - 1, 11, 31)))
    return { preset, from, to: today, days, prev: sameStretch(prevStart, days, prevYearDays) }
  }

  // month — the default, and month-to-date rather than the whole calendar month.
  const from = startOfMonth(y, m)
  const days = daysBetween(from, today)
  const prevStart = startOfMonth(y, m - 1)
  const prevMonthDays = lastDayOf(new Date(prevStart).getUTCFullYear(), new Date(prevStart).getUTCMonth())
  return { preset: 'month', from, to: today, days, prev: sameStretch(prevStart, days, prevMonthDays) }
}

/** Percentage change, or null when there is no earlier figure to divide by. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null
  return ((now - before) / Math.abs(before)) * 100
}
