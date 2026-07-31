import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtDate, fromDayString } from '../lib/datetime'

/**
 * Daily sales as an extruded bar chart.
 *
 * The depth is isometric, not perspective. A `perspective` scene was the
 * obvious way to get 3D and it quietly broke the chart: projection displaces
 * the top of a bar further sideways than its base, so every bar away from the
 * centre leaned inward and rendered as a trapezoid instead of a rectangle. The
 * further from centre, the worse the lean — and a bar chart whose bars are not
 * the same shape cannot be read by eye, which is the only thing it is for.
 *
 * So each bar is extruded by the same fixed offset instead: a front rectangle,
 * a top face skewed 45 degrees and a side face skewed the other way. Identical
 * for every bar, at every position, at every height. Nothing is projected, so
 * nothing keystones, the baseline is level by construction, and the labels sit
 * exactly under the bars they name.
 *
 * A side effect worth having: with no `perspective` and no `transform-style`
 * there is nothing left to flatten, so the whole class of bugs around filters
 * and running transform animations collapsing a 3D scene no longer applies
 * here.
 */

/** The extrusion runs up and to the right at 45 degrees, so dx equals dy. */
const DEPTH_RATIO = 0.34
const DEPTH_MIN = 4
const DEPTH_MAX = 13
const GREEN = '#16a679'

export interface DayPoint { day: string; total: number }

interface Bucket { label: string; title: string; total: number }

/**
 * A year is 365 bars in a space with room for about thirty, so longer ranges
 * are grouped until the axis is legible. The totals are unchanged — only the
 * width of a bucket is.
 */
function bucketise(points: DayPoint[], lang: string): { buckets: Bucket[]; grain: 'day' | 'week' | 'month' } {
  const n = points.length
  const grain: 'day' | 'week' | 'month' = n <= 31 ? 'day' : n <= 120 ? 'week' : 'month'

  if (grain === 'day') {
    return {
      grain,
      buckets: points.map(p => ({
        label: fmtDate(fromDayString(p.day), lang, { day: 'numeric' }),
        title: fmtDate(fromDayString(p.day), lang, { day: 'numeric', month: 'short' }),
        total: p.total,
      })),
    }
  }

  const groups = new Map<string, { total: number; first: string; last: string }>()
  for (const p of points) {
    let key: string
    if (grain === 'month') {
      key = p.day.slice(0, 7)
    } else {
      // Weeks are cut on a fixed 7-day stride from the range's first day, so
      // every bucket is the same width and the last one is not a stub.
      const idx = Math.floor((Date.parse(p.day) - Date.parse(points[0].day)) / (7 * 86_400_000))
      key = `w${idx}`
    }
    const g = groups.get(key) ?? { total: 0, first: p.day, last: p.day }
    g.total += p.total
    g.last = p.day
    groups.set(key, g)
  }

  return {
    grain,
    buckets: Array.from(groups.values()).map(g => ({
      label: grain === 'month'
        ? fmtDate(fromDayString(g.first), lang, { month: 'short' })
        : fmtDate(fromDayString(g.first), lang, { day: 'numeric', month: 'numeric' }),
      title: grain === 'month'
        ? fmtDate(fromDayString(g.first), lang, { month: 'long', year: 'numeric' })
        : `${fmtDate(fromDayString(g.first), lang, { day: 'numeric', month: 'short' })} — ${fmtDate(fromDayString(g.last), lang, { day: 'numeric', month: 'short' })}`,
      total: g.total,
    })),
  }
}

/** Rounds the top of the scale up so the gridlines land on readable numbers. */
function niceMax(v: number) {
  if (v <= 0) return 100
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const step = [1, 2, 2.5, 5, 10].find(s => v <= s * mag)! * mag
  return step
}

export default function SalesChart3D({
  points, lang, currency,
}: { points: DayPoint[]; lang: string; currency: string }) {
  const isAR = lang === 'ar'
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [grown, setGrown] = useState(false)
  const [settled, setSettled] = useState(false)

  const { buckets, grain } = useMemo(() => bucketise(points, lang), [points, lang])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // One frame after mount the bars go from flat to full height.
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    // Once the entrance is over the stagger has to go, or hovering the last bar
    // would wait out its own entrance delay before it moved.
    const t = setTimeout(() => setSettled(true), 1200)
    return () => { cancelAnimationFrame(id); clearTimeout(t) }
  }, [])

  const n = Math.max(1, buckets.length)
  const slot = width / n
  const barW = Math.max(5, Math.min(38, slot * 0.6))
  const depth = Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, barW * DEPTH_RATIO))

  const peak = Math.max(...buckets.map(b => b.total), 0)
  const scale = niceMax(peak)
  const total = buckets.reduce((s, b) => s + b.total, 0)
  const gridlines = [1, 0.75, 0.5, 0.25, 0]

  // With many bars every label collides, so only every kth is drawn.
  const labelEvery = Math.max(1, Math.ceil(n / 16))

  if (peak <= 0) {
    return (
      <div className="tbl-empty" style={{ padding: '46px 0' }}>
        {isAR ? 'لا توجد مبيعات في هذه الفترة' : 'No sales in this period'}
      </div>
    )
  }

  return (
    <div className="chart3d">
      <div className="chart3d-head">
        <span className="chart3d-total num">
          {total.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="chart3d-cur">{currency}</span>
        </span>
        <span className="chart3d-grain">
          {grain === 'day' ? (isAR ? 'يومي' : 'Daily')
            : grain === 'week' ? (isAR ? 'أسبوعي' : 'Weekly')
            : (isAR ? 'شهري' : 'Monthly')}
        </span>
      </div>

      <div className="plot">

        <div className="yaxis">
          {gridlines.map(g => (
            <span key={g} className="yval num" style={{ bottom: `${g * 100}%` }}>
              {Math.round(scale * g).toLocaleString('en-US')}
            </span>
          ))}
        </div>

        <div className="stage" onMouseLeave={() => setHover(null)}>
          {/* Room above and to the side for the extrusion to occupy without
              pushing the bars off their own scale. */}
          <div className="grid" style={{ top: depth, insetInlineEnd: depth }}>
            {gridlines.map(g => (
              <div key={g} className={`gline${g === 0 ? ' base' : ''}`} style={{ bottom: `${g * 100}%` }} />
            ))}
          </div>

          <div className="track" ref={trackRef} style={{ top: depth, insetInlineEnd: depth }}>
            {buckets.map((b, i) => {
              const h = (b.total / scale) * 100
              const isHot = hover === i
              return (
                <div key={i} className="cell" onMouseEnter={() => setHover(i)}>
                  {/* A day with no sales draws nothing. A zero-height box still
                      painted its top and side faces, which read as scratches
                      along the baseline. */}
                  {b.total > 0 && (
                    <div
                      className={`bar${isHot ? ' hot' : ''}`}
                      style={{
                        width: barW,
                        height: grown ? `${h}%` : 0,
                        transitionDelay: settled ? '0ms' : `${Math.min(i * 18, 420)}ms`,
                      }}
                    >
                      <div className="front" />
                      <div className="top" style={{ height: depth }} />
                      <div className="side" style={{ width: depth }} />
                    </div>
                  )}

                  {i % labelEvery === 0 && <span className="xlabel num">{b.label}</span>}

                  {isHot && (
                    <div className="tip" style={{ bottom: `${h}%` }}>
                      <div className="tip-day">{b.title}</div>
                      <div className="tip-val num">{b.total.toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .chart3d { padding: 2px 2px 0 }
        .chart3d-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 10px; margin-bottom: 10px;
        }
        .chart3d-total { font-size: 22px; font-weight: 800; letter-spacing: -0.6px; color: #0b0f1a }
        .chart3d-cur { font-size: 12px; font-weight: 600; color: #9ca3af }
        .chart3d-grain {
          font-size: 11px; font-weight: 600; color: #64748b;
          background: #f1f5f9; border-radius: 99px; padding: 3px 10px;
        }

        .plot { display: flex; gap: 8px }
        .yaxis { width: 46px; flex: none; position: relative; height: 190px }
        .yval {
          position: absolute; inset-inline-end: 0; transform: translateY(50%);
          font-size: 9.5px; color: #b4c0cf; font-weight: 600; white-space: nowrap;
        }

        .stage { position: relative; flex: 1; min-width: 0; height: 190px; padding-bottom: 26px }
        .grid { position: absolute; inset-inline-start: 0; bottom: 26px }
        .gline { position: absolute; left: 0; right: 0; height: 1px; background: #eef2f7 }
        .gline.base { background: #dde3ea }

        .track {
          position: absolute; inset-inline-start: 0; bottom: 26px;
          display: flex; align-items: flex-end;
        }
        .cell {
          flex: 1 1 0; min-width: 0; height: 100%;
          display: flex; align-items: flex-end; justify-content: center;
          position: relative;
        }

        .bar {
          position: relative;
          transition: height 0.62s cubic-bezier(0.2, 0.75, 0.25, 1);
        }
        .front {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #29cd9c, #14976e);
        }
        /* Skewed 45deg about its bottom-left corner, which turns the rectangle
           into exactly the parallelogram the extrusion needs — the same shape
           whatever the bar's height or position. */
        .top {
          position: absolute; bottom: 100%; left: 0; width: 100%;
          background: #66e8c1;
          transform: skewX(-45deg);
          transform-origin: bottom left;
        }
        .side {
          position: absolute; top: 0; left: 100%; height: 100%;
          background: #0d7d5c;
          transform: skewY(-45deg);
          transform-origin: bottom left;
        }
        .bar.hot .front { background: linear-gradient(180deg, #12b287, #0a7d5b) }
        .bar.hot .top { background: #8df3d5 }
        .bar.hot .side { background: #085f45 }

        .xlabel {
          position: absolute; top: 100%; left: 50%; margin-top: 8px;
          transform: translateX(-50%);
          font-size: 9.5px; color: #9ca3af; font-weight: 600; white-space: nowrap;
        }

        .tip {
          position: absolute; left: 50%; transform: translateX(-50%);
          margin-bottom: 12px;
          background: #0b0f1a; color: #fff;
          border-radius: 8px; padding: 6px 10px;
          white-space: nowrap; pointer-events: none;
          box-shadow: 0 8px 20px rgba(11, 15, 26, 0.28);
          z-index: 5;
        }
        .tip-day { font-size: 10px; opacity: 0.7; margin-bottom: 2px }
        .tip-val { font-size: 12.5px; font-weight: 700 }

        @media (max-width: 640px) {
          .stage, .yaxis { height: 150px }
          .chart3d-total { font-size: 18px }
          .yaxis { width: 34px }
        }
        @media (prefers-reduced-motion: reduce) {
          .bar { transition: none }
        }
      `}</style>
    </div>
  )
}
