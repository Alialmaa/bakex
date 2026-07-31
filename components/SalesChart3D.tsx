import { useEffect, useMemo, useRef, useState } from 'react'
import { useTilt } from '../lib/useTilt'
import { fmtDate, fromDayString } from '../lib/datetime'

/**
 * Daily sales as a bar chart with real depth.
 *
 * The bars are CSS cuboids: each one is a `preserve-3d` box holding a front, a
 * top and a right face, sitting in a scene with `perspective`. That is what
 * makes it read as 3D rather than as a picture of 3D — the faces are separate
 * planes and the perspective divides them differently across the scene.
 *
 * The scene turns on X only. A resting rotateY looked better in isolation and
 * ruined the chart: rotating about the vertical axis puts the baseline on a
 * slope, so a bar on the right sat higher than an equal bar on the left and the
 * one thing a bar chart exists to do — compare heights — no longer worked. The
 * measured slope was the whole width of the card; it is zero now.
 *
 * For the same reason the axis labels live *inside* each cell rather than in a
 * row underneath: a flat row cannot follow bars that perspective has spread
 * apart, and the outermost label sat 45px from the bar it named. Inside the
 * cell they ride the same transform and are counter-rotated to stay upright.
 * The value labels go the other way — out of the scene entirely, into a static
 * gutter, because text on a tilted plane is blurred and hard to read.
 *
 * Two things silently destroy the depth, both learned the hard way:
 *
 *   * a `filter` or `backdrop-filter` anywhere up the tree forces
 *     `transform-style` back to `flat`;
 *   * so does a *running* transform animation — including one that only keeps
 *     running because it has a fill mode. Growth is animated on `height` here
 *     for exactly that reason.
 *
 * Touch devices and anyone asking for reduced motion get the same chart at the
 * resting angle, without the pointer tracking.
 */

const BASE_TILT = 18
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
  // A small pointer range: every degree of rotateY tips the baseline, so this
  // is a wobble under the cursor, not a viewing angle.
  const { ref, onMove, onLeave } = useTilt(4, BASE_TILT, 0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [grown, setGrown] = useState(false)

  const { buckets, grain } = useMemo(() => bucketise(points, lang), [points, lang])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // One frame after mount the bars go from flat to full height. The transition
  // is on `height`, never on `transform` — see the note at the top.
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const n = Math.max(1, buckets.length)
  const slot = width / n
  const barW = Math.max(5, Math.min(38, slot * 0.6))
  const depth = Math.max(6, Math.min(16, barW * 0.72))

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

        {/* Values live outside the 3D scene: text on a tilted plane is blurred. */}
        <div className="yaxis">
          {gridlines.map(g => (
            <span key={g} className="yval num" style={{ bottom: `${g * 100}%` }}>
              {Math.round(scale * g).toLocaleString('en-US')}
            </span>
          ))}
        </div>

        <div className="scene" onMouseMove={onMove} onMouseLeave={() => { onLeave(); setHover(null) }}>
          <div className="stage" ref={ref}>

            <div className="grid">
              {gridlines.map(g => (
                <div key={g} className={`gline${g === 0 ? ' base' : ''}`} style={{ bottom: `${g * 100}%` }} />
              ))}
            </div>

            <div className="track" ref={trackRef}>
              {buckets.map((b, i) => {
                const h = (b.total / scale) * 100
                const isHot = hover === i
                return (
                  <div key={i} className="cell" onMouseEnter={() => setHover(i)}>
                    {/* A day with no sales draws nothing. Rendering a zero-height
                        box still painted its top and side faces, which read as
                        scratches along the baseline. */}
                    {b.total > 0 && (
                      <div
                        className={`bar${isHot ? ' hot' : ''}`}
                        style={{ width: barW, height: grown ? `${h}%` : 0, transitionDelay: `${Math.min(i * 18, 420)}ms` }}
                      >
                        <div className="face front" style={{ transform: `translateZ(${depth / 2}px)` }} />
                        <div className="face top" style={{ height: depth, transform: `translateY(${-depth / 2}px) rotateX(90deg)` }} />
                        <div className="face side" style={{ width: depth, transform: `translateX(${barW - depth / 2}px) rotateY(90deg)` }} />
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

        /* The perspective lives here and nothing between it and the faces may
           flatten: no filter, no opacity animation on a transformed ancestor. */
        .scene {
          flex: 1; min-width: 0;
          perspective: 1900px;
          perspective-origin: 50% 50%;
          padding-bottom: 26px;
        }
        .stage {
          position: relative;
          height: 190px;
          transform-style: preserve-3d;
          /* rotateX only — see the note at the top of this file. */
          transform: rotateX(${BASE_TILT}deg) rotateY(0deg);
          transition: transform 0.25s ease-out;
        }

        .grid { position: absolute; inset: 0; transform-style: preserve-3d }
        .gline { position: absolute; left: 0; right: 0; height: 1px; background: #eef2f7 }
        .gline.base { background: #dde3ea }

        .track {
          position: absolute; inset: 0;
          display: flex; align-items: flex-end;
          transform-style: preserve-3d;
        }
        .cell {
          flex: 1 1 0; min-width: 0; height: 100%;
          display: flex; align-items: flex-end; justify-content: center;
          position: relative;
          transform-style: preserve-3d;
        }

        .bar {
          position: relative;
          transform-style: preserve-3d;
          /* Height, not transform — a running transform animation flattens
             every child face back into one plane. */
          transition: height 0.62s cubic-bezier(0.2, 0.75, 0.25, 1);
        }
        .face { position: absolute }
        .front { inset: 0; background: linear-gradient(180deg, #25c795, #159c72) }
        .top { top: 0; left: 0; width: 100%; background: #6ceecb }
        .side { top: 0; left: 0; height: 100%; background: #0e6f53 }
        .bar.hot .front { background: linear-gradient(180deg, #16b184, #0d8a63) }
        .bar.hot .top { background: #8bf5d8 }
        .bar.hot .side { background: #0a5943 }

        /* Inside the cell so it tracks its own bar, counter-rotated so the
           digits stay upright. */
        .xlabel {
          position: absolute; top: 100%; left: 50%; margin-top: 7px;
          font-size: 9.5px; color: #9ca3af; font-weight: 600; white-space: nowrap;
          transform: translateX(-50%) rotateX(-${BASE_TILT}deg);
          transform-origin: top center;
        }

        .tip {
          position: absolute; left: 50%;
          transform: translateX(-50%) translateZ(40px) rotateX(-${BASE_TILT}deg);
          margin-bottom: 10px;
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
          .stage { transition: none }
        }
      `}</style>
    </div>
  )
}
