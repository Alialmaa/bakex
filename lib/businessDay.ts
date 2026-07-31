/**
 * What "today" means to the bakery.
 *
 * Every calendar date in this app used to come from `toISOString()`, which is
 * UTC. Saudi Arabia is UTC+3, so between midnight and 3am local the UTC date is
 * still yesterday's — and bakeries work through exactly those hours. A sale
 * recorded at 1am was filed under the previous day, the date picker opened on
 * the wrong date, and "مبيعات اليوم" measured a day that had already ended.
 *
 * Everything that turns an instant into a date, or a date into a range of
 * instants, goes through this file. A single constant decides the boundary, so
 * moving to another market is one edit rather than a hunt through six pages.
 *
 * The offset is fixed rather than read from a timezone database because Saudi
 * Arabia has never observed daylight saving: +03:00 is exact all year, and a
 * fixed offset cannot drift out of step with the SQL side, which applies the
 * same shift.
 */

/** Used by the SQL aggregates. Keep in step with BUSINESS_OFFSET. */
export const BUSINESS_TZ = 'Asia/Riyadh'

/** Saudi Arabia is UTC+3 year-round — no daylight saving. */
export const BUSINESS_OFFSET = '+03:00'

const OFFSET_MS = 3 * 3_600_000
const DAY_MS = 86_400_000

/** Today's date where the bakery is, as `YYYY-MM-DD`. */
export function businessToday(now: Date = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * The instant a business day starts, as UTC.
 * `2026-07-31` → `2026-07-30T21:00:00.000Z`
 */
export function dayStart(day: string): string {
  return new Date(`${day}T00:00:00.000${BUSINESS_OFFSET}`).toISOString()
}

/**
 * The last instant of a business day, as UTC. Inclusive, because the SQL
 * aggregates compare with `<= p_to`.
 */
export function dayEnd(day: string): string {
  return new Date(`${day}T23:59:59.999${BUSINESS_OFFSET}`).toISOString()
}

/**
 * The instant to stamp on a sale or a production entry recorded *for* a given
 * day rather than at the moment it happened.
 *
 * Midday local, so the row lands unambiguously inside its day whatever the
 * server's own timezone is. `new Date('2026-07-31T12:00:00')` — no offset —
 * is parsed in the *server's* local time, which is UTC on Vercel and something
 * else on a developer's laptop.
 */
export function dayStamp(day: string): string {
  return new Date(`${day}T12:00:00.000${BUSINESS_OFFSET}`).toISOString()
}

/** True when an ISO instant falls on the given business day. */
export function isOnDay(instant: string | null | undefined, day: string): boolean {
  if (!instant) return false
  const t = Date.parse(instant)
  if (Number.isNaN(t)) return false
  return t >= Date.parse(dayStart(day)) && t <= Date.parse(dayEnd(day))
}

/** The first day of the month containing `day`. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Inclusive of both ends: the 1st to the 1st is one day, not zero. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS) + 1
}
