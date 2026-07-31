import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  businessToday, dayStart, dayEnd, dayStamp, isOnDay, monthStart, addDays, daysBetween, BUSINESS_OFFSET,
} from '../lib/businessDay'

/**
 * Every date in the app used to come from toISOString(), which is UTC. Riyadh
 * is three hours ahead, so between midnight and 3am the UTC date is still
 * yesterday's — and that is exactly when a bakery is working. These pin the
 * boundary so the mistake cannot come back one call site at a time.
 */

describe('businessToday', () => {
  test('01:30 in Riyadh is already the new day', () => {
    // 2026-07-30T22:30Z is 2026-07-31T01:30 in Riyadh.
    assert.equal(businessToday(new Date('2026-07-30T22:30:00.000Z')), '2026-07-31')
  })

  test('23:30 in Riyadh is still the old day', () => {
    assert.equal(businessToday(new Date('2026-07-30T20:30:00.000Z')), '2026-07-30')
  })

  test('the moment the day turns over', () => {
    assert.equal(businessToday(new Date('2026-07-30T20:59:59.999Z')), '2026-07-30')
    assert.equal(businessToday(new Date('2026-07-30T21:00:00.000Z')), '2026-07-31')
  })

  test('rolls the month and the year over with it', () => {
    // 2025-12-31T22:00Z is 2026-01-01T01:00 in Riyadh.
    assert.equal(businessToday(new Date('2025-12-31T22:00:00.000Z')), '2026-01-01')
  })
})

describe('dayStart and dayEnd', () => {
  test('bracket exactly one day', () => {
    const start = Date.parse(dayStart('2026-07-31'))
    const end = Date.parse(dayEnd('2026-07-31'))
    assert.equal(end - start, 86_400_000 - 1)
  })

  test('start three hours before UTC midnight', () => {
    assert.equal(dayStart('2026-07-31'), '2026-07-30T21:00:00.000Z')
    assert.equal(dayEnd('2026-07-31'), '2026-07-31T20:59:59.999Z')
  })

  test('one day ends the instant before the next begins, with no gap and no overlap', () => {
    assert.equal(Date.parse(dayEnd('2026-07-31')) + 1, Date.parse(dayStart('2026-08-01')))
  })

  test('every day of a leap February is bracketed', () => {
    for (let d = 1; d <= 29; d++) {
      const day = `2024-02-${String(d).padStart(2, '0')}`
      assert.ok(isOnDay(dayStart(day), day), day)
      assert.ok(isOnDay(dayEnd(day), day), day)
    }
  })
})

describe('dayStamp', () => {
  test('lands in the middle of its own day', () => {
    assert.ok(isOnDay(dayStamp('2026-07-31'), '2026-07-31'))
  })

  test('does not depend on the server timezone', () => {
    // The bare `new Date('2026-07-31T12:00:00')` this replaced was parsed in
    // the server's local time: UTC on Vercel, anything on a laptop.
    assert.equal(dayStamp('2026-07-31'), '2026-07-31T09:00:00.000Z')
  })

  test('a sale dated the 1st is never filed under the 31st', () => {
    assert.ok(!isOnDay(dayStamp('2026-08-01'), '2026-07-31'))
    assert.ok(isOnDay(dayStamp('2026-08-01'), '2026-08-01'))
  })
})

describe('isOnDay', () => {
  test('a sale at 22:30 UTC belongs to the next Riyadh day', () => {
    assert.equal(isOnDay('2026-07-30T22:30:00.000Z', '2026-07-31'), true)
    assert.equal(isOnDay('2026-07-30T22:30:00.000Z', '2026-07-30'), false)
  })

  test('is false rather than throwing for a missing or unparseable value', () => {
    assert.equal(isOnDay(null, '2026-07-31'), false)
    assert.equal(isOnDay(undefined, '2026-07-31'), false)
    assert.equal(isOnDay('not a date', '2026-07-31'), false)
  })
})

describe('the calendar helpers', () => {
  test('monthStart keeps the month it was given', () => {
    assert.equal(monthStart('2026-07-31'), '2026-07-01')
    assert.equal(monthStart('2026-01-01'), '2026-01-01')
  })

  test('addDays crosses months and years', () => {
    assert.equal(addDays('2026-07-31', 1), '2026-08-01')
    assert.equal(addDays('2026-01-01', -1), '2025-12-31')
    assert.equal(addDays('2024-02-28', 1), '2024-02-29')
  })

  test('daysBetween counts both ends', () => {
    assert.equal(daysBetween('2026-07-01', '2026-07-01'), 1)
    assert.equal(daysBetween('2026-07-01', '2026-07-31'), 31)
  })

  test('the offset is the fixed one Saudi Arabia uses all year', () => {
    // No daylight saving, so nothing here needs a timezone database.
    assert.equal(BUSINESS_OFFSET, '+03:00')
  })
})
