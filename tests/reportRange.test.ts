import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRange, pctChange, fromBound, toBound, PRESETS } from '../lib/reportRange'

/**
 * The range decides which rows every figure on the reports page is built from,
 * and it arrives in a query string anyone can edit. These fix the two things
 * that go wrong quietly: a boundary that drops or double-counts a day, and a
 * comparison window that compares the start of one month with the end of
 * another and calls the difference a trend.
 */

// A Wednesday, mid-month, mid-quarter — nothing about it is a special case.
const NOW = new Date('2026-07-15T09:30:00.000Z')

describe('resolveRange — the periods', () => {
  test('defaults to month-to-date, which is what the page always showed', () => {
    const r = resolveRange({}, NOW)
    assert.equal(r.preset, 'month')
    assert.equal(r.from, '2026-07-01')
    assert.equal(r.to, '2026-07-15')
    assert.equal(r.days, 15)
  })

  test('today is a single day, not an empty range', () => {
    const r = resolveRange({ preset: 'today' }, NOW)
    assert.equal(r.from, '2026-07-15')
    assert.equal(r.to, '2026-07-15')
    assert.equal(r.days, 1)
  })

  test('a week is seven days ending today, not the last six', () => {
    const r = resolveRange({ preset: 'week' }, NOW)
    assert.equal(r.from, '2026-07-09')
    assert.equal(r.to, '2026-07-15')
    assert.equal(r.days, 7)
  })

  test('a quarter starts on the first of its first month', () => {
    const r = resolveRange({ preset: 'quarter' }, NOW)
    assert.equal(r.from, '2026-07-01') // Q3
    assert.equal(r.prev.from, '2026-04-01')
  })

  test('a year starts on 1 January', () => {
    const r = resolveRange({ preset: 'year' }, NOW)
    assert.equal(r.from, '2026-01-01')
    assert.equal(r.prev.from, '2025-01-01')
  })

  test('every preset produces a from no later than its to', () => {
    for (const p of PRESETS) {
      const r = resolveRange({ preset: p }, NOW)
      assert.ok(r.from <= r.to, `${p}: ${r.from} > ${r.to}`)
      assert.ok(r.prev.from <= r.prev.to, `${p} prev: ${r.prev.from} > ${r.prev.to}`)
      assert.ok(r.prev.to < r.from, `${p}: the comparison window must end before the period starts`)
    }
  })
})

describe('resolveRange — the comparison window', () => {
  test('month-to-date is compared with the same days of the previous month', () => {
    // Not "the 15 days before 1 July", which would be the second half of June
    // measured against the first half of July.
    const r = resolveRange({ preset: 'month' }, NOW)
    assert.equal(r.prev.from, '2026-06-01')
    assert.equal(r.prev.to, '2026-06-15')
  })

  test('a month-to-date longer than the previous month is clipped, not rolled over', () => {
    const march31 = new Date('2026-03-31T12:00:00.000Z')
    const r = resolveRange({ preset: 'month' }, march31)
    assert.equal(r.days, 31)
    assert.equal(r.prev.from, '2026-02-01')
    assert.equal(r.prev.to, '2026-02-28', 'February has no 31st to compare against')
  })

  test('a leap February is 29 days, not 28', () => {
    const r = resolveRange({ preset: 'month' }, new Date('2024-03-31T12:00:00.000Z'))
    assert.equal(r.prev.to, '2024-02-29')
  })

  test('a week is compared with the seven days immediately before it', () => {
    const r = resolveRange({ preset: 'week' }, NOW)
    assert.equal(r.prev.from, '2026-07-02')
    assert.equal(r.prev.to, '2026-07-08')
  })

  test('January is compared with the previous December', () => {
    const r = resolveRange({ preset: 'month' }, new Date('2026-01-10T12:00:00.000Z'))
    assert.equal(r.prev.from, '2025-12-01')
    assert.equal(r.prev.to, '2025-12-10')
  })

  test('the first quarter is compared with the last quarter of the year before', () => {
    const r = resolveRange({ preset: 'quarter' }, new Date('2026-02-10T12:00:00.000Z'))
    assert.equal(r.from, '2026-01-01')
    assert.equal(r.prev.from, '2025-10-01')
  })
})

describe('resolveRange — untrusted input', () => {
  test('accepts a valid custom range', () => {
    const r = resolveRange({ preset: 'custom', from: '2026-03-01', to: '2026-03-10' }, NOW)
    assert.equal(r.preset, 'custom')
    assert.equal(r.days, 10)
    assert.equal(r.prev.from, '2026-02-19')
    assert.equal(r.prev.to, '2026-02-28')
  })

  test('falls back to the default rather than showing an empty report', () => {
    for (const bad of [
      { preset: 'custom', from: 'yesterday', to: 'today' },
      { preset: 'custom', from: '2026-03-10', to: '2026-03-01' }, // backwards
      { preset: 'custom', from: '2026-03-01' },                   // no end
      { preset: 'nonsense' },
      { preset: '' },
    ]) {
      const r = resolveRange(bad as any, NOW)
      assert.equal(r.preset, 'month', JSON.stringify(bad))
      assert.equal(r.from, '2026-07-01')
    }
  })

  test('caps a custom range so one URL cannot ask for a decade', () => {
    const r = resolveRange({ preset: 'custom', from: '2016-01-01', to: '2026-01-01' }, NOW)
    assert.equal(r.days, 731)
    assert.equal(r.to, '2017-12-31')
  })

  test('takes the first value when a parameter is repeated', () => {
    // ?preset=week&preset=year arrives as an array.
    const r = resolveRange({ preset: ['week', 'year'] }, NOW)
    assert.equal(r.preset, 'week')
  })

  test('a bare from and to without a preset is still honoured', () => {
    const r = resolveRange({ from: '2026-05-01', to: '2026-05-31' }, NOW)
    assert.equal(r.preset, 'custom')
    assert.equal(r.days, 31)
  })
})

describe('the bounds handed to Postgres', () => {
  test('cover the whole of both end days', () => {
    // The aggregates compare with `>= p_from AND <= p_to`. A bare date as the
    // upper bound would mean midnight, dropping everything sold that day.
    assert.equal(fromBound('2026-07-01'), '2026-07-01T00:00:00.000Z')
    assert.equal(toBound('2026-07-15'), '2026-07-15T23:59:59.999Z')
  })

  test('a period and its comparison window do not overlap by an instant', () => {
    const r = resolveRange({ preset: 'month' }, NOW)
    assert.ok(toBound(r.prev.to) < fromBound(r.from))
  })
})

describe('pctChange', () => {
  test('is a percentage of the earlier figure', () => {
    assert.equal(pctChange(150, 100), 50)
    assert.equal(pctChange(50, 100), -50)
    assert.equal(pctChange(100, 100), 0)
  })

  test('is null rather than infinite when there was nothing before', () => {
    assert.equal(pctChange(500, 0), null)
    assert.equal(pctChange(0, 0), null)
  })

  test('a recovery from a loss reads as growth', () => {
    // Dividing by a negative would otherwise flip the sign: profit going from
    // −100 to −50 is an improvement and must not render as −50%.
    assert.equal(pctChange(-50, -100), 50)
  })
})
