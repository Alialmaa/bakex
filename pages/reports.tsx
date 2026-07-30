import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { buildReport, type ReportPayload } from '../lib/reports'
import { PRESETS, type Preset } from '../lib/reportRange'
import Layout from '../components/Layout'
import { MetricCard, Icons } from '../components/Metric'
import SalesChart3D from '../components/SalesChart3D'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { fmtTime, fmtDate, fromDayString } from '../lib/datetime'
import { toCsv, downloadCsv, reportCsv } from '../lib/csv'

const COLS = '26px 1.4fr 78px 74px 66px 88px 84px 78px'

const PRESET_LABEL: Record<Preset, { ar: string; en: string }> = {
  today:   { ar: 'اليوم',      en: 'Today' },
  week:    { ar: '٧ أيام',     en: '7 days' },
  month:   { ar: 'هذا الشهر',  en: 'This month' },
  quarter: { ar: 'هذا الربع',  en: 'This quarter' },
  year:    { ar: 'هذه السنة',  en: 'This year' },
  custom:  { ar: 'مخصص',       en: 'Custom' },
}

/** A signed percentage next to a metric, muted when there is nothing to compare to. */
function Delta({ pct, lang, invert }: { pct: number | null; lang: string; invert?: boolean }) {
  if (pct === null) {
    return <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{lang === 'ar' ? 'لا مقارنة' : 'no prior'}</span>
  }
  const up = pct >= 0
  // For cost and spend, up is the bad direction.
  const good = invert ? !up : up
  const color = Math.abs(pct) < 0.5 ? '#94a3b8' : good ? '#059669' : '#dc2626'
  // Bidi isolates: without them an Arabic line renders "12.4%−" instead of "−12.4%".
  const sign = up ? '+' : '−'
  return (
    <span className="num" style={{ fontSize: 11.5, color, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {'⁦'}{sign}{Math.abs(pct).toFixed(1)}%{'⁩'}
    </span>
  )
}

type SortKey = 'profit' | 'margin' | 'revenue' | 'qty' | 'cost'

export default function ReportsPage({ user, initial }: { user: any; initial: ReportPayload }) {
  const { lang, setLang } = useLang()
  const router = useRouter()
  const t = T[lang]
  const cur = t.currency
  const isAR = lang === 'ar'

  const [report, setReport] = useState<ReportPayload>(initial)
  const [sort, setSort] = useState<SortKey>('profit')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [customFrom, setCustomFrom] = useState(initial.range.from)
  const [customTo, setCustomTo] = useState(initial.range.to)
  const [showCustom, setShowCustom] = useState(initial.range.preset === 'custom')

  const { range, data, totals, change, previous, prodSummary, daily, warnings } = report

  const query = useMemo(() => (
    range.preset === 'custom'
      ? { preset: 'custom', from: range.from, to: range.to }
      : { preset: range.preset }
  ), [range])

  const load = useCallback(async (q: Record<string, string>) => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/reports?${new URLSearchParams(q)}`)
      if (res.ok) {
        setReport(await res.json())
        setLastUpdated(new Date())
      }
    } finally { setRefreshing(false) }
  }, [])

  /** The URL mirrors the range so a reload, a bookmark or a shared link all land on the same period. */
  const pick = useCallback((q: Record<string, string>) => {
    router.push({ pathname: '/reports', query: q }, undefined, { shallow: true })
    load(q)
  }, [router, load])

  // Auto-refresh keeps whatever period is on screen — it used to snap back to
  // the current month because the range lived only in getServerSideProps.
  useEffect(() => {
    const id = setInterval(() => load(query as Record<string, string>), 30_000)
    return () => clearInterval(id)
  }, [load, query])

  const sorted = useMemo(() => [...data].sort((a, b) => {
    if (sort === 'margin') return (b.margin ?? -Infinity) - (a.margin ?? -Infinity)
    if (sort === 'revenue') return b.revenue - a.revenue
    if (sort === 'qty') return b.qty - a.qty
    if (sort === 'cost') return b.unitCost - a.unitCost
    return b.profit - a.profit
  }), [data, sort])

  // Always by profit, whatever the table is sorted by. These panels used to be
  // the table's own order reversed, so sorting by cost labelled the cheapest
  // products "lowest performers".
  const byProfit = useMemo(() => [...data].sort((a, b) => b.profit - a.profit), [data])
  const maxProfit = Math.max(...byProfit.map(d => Math.abs(d.profit)), 1)

  const periodLabel = range.from === range.to
    ? fmtDate(fromDayString(range.from), lang, { day: 'numeric', month: 'long', year: 'numeric' })
    : `${fmtDate(fromDayString(range.from), lang, { day: 'numeric', month: 'short' })} — ${fmtDate(fromDayString(range.to), lang, { day: 'numeric', month: 'short', year: 'numeric' })}`

  const exportCsv = () => {
    downloadCsv(
      `bakex-report-${range.from}-${range.to}.csv`,
      toCsv(reportCsv(report, lang))
    )
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Range picker */}
        <div className="card rpt-bar">
          <div className="rpt-presets">
            {PRESETS.map(p => (
              <button key={p} onClick={() => { setShowCustom(false); pick({ preset: p }) }}
                className={`rpt-chip${range.preset === p ? ' on' : ''}`}>
                {PRESET_LABEL[p][isAR ? 'ar' : 'en']}
              </button>
            ))}
            <button onClick={() => setShowCustom(v => !v)}
              className={`rpt-chip${range.preset === 'custom' ? ' on' : ''}`}>
              <span className="ico-sm" style={{ marginInlineEnd: 5 }}>{Icons.calendar}</span>
              {PRESET_LABEL.custom[isAR ? 'ar' : 'en']}
            </button>
          </div>

          <div className="rpt-actions">
            <button onClick={exportCsv} className="btn rpt-act" title={isAR ? 'تصدير CSV' : 'Export CSV'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {isAR ? 'تصدير' : 'Export'}
            </button>
            <button onClick={() => window.print()} className="btn rpt-act" title={isAR ? 'طباعة' : 'Print'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              {isAR ? 'طباعة' : 'Print'}
            </button>
            <button onClick={() => load(query as Record<string, string>)} disabled={refreshing} className="btn rpt-act">
              {refreshing ? '...' : (isAR ? '↻' : '↻')}
            </button>
          </div>

          {showCustom && (
            <div className="rpt-custom">
              <label>{isAR ? 'من' : 'From'}
                <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} />
              </label>
              <label>{isAR ? 'إلى' : 'To'}
                <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} />
              </label>
              <button className="btn btn-primary rpt-act"
                onClick={() => pick({ preset: 'custom', from: customFrom, to: customTo })}>
                {isAR ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          )}
        </div>

        {/* Period line */}
        <div className="rpt-period">
          <span className="rpt-period-main">
            <span className="ico-sm" style={{ color: '#16a679' }}>{Icons.calendar}</span>
            {periodLabel}
            <span className="num rpt-days">{range.days} {isAR ? 'يوم' : range.days === 1 ? 'day' : 'days'}</span>
          </span>
          <span className="rpt-period-sub" suppressHydrationWarning>
            {isAR ? 'مقارنة بـ' : 'vs'} {fmtDate(fromDayString(range.prev.from), lang, { day: 'numeric', month: 'short' })}
            {' — '}
            {fmtDate(fromDayString(range.prev.to), lang, { day: 'numeric', month: 'short' })}
            <span className="rpt-sep">|</span>
            {isAR ? 'آخر تحديث' : 'Updated'} {fmtTime(lastUpdated, lang, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Metrics */}
        <div className="rpt-metrics">
          <MetricCard
            label={t.reports.totalRev} value={totals.revenue.toFixed(0)} unit={cur}
            sub={undefined} icon={Icons.trendUp} tone="green"
          />
          <MetricCard
            label={t.reports.totalCost} value={totals.cost.toFixed(0)} unit={cur}
            icon={Icons.trendDown} tone="red" valueColor="#dc2626"
          />
          <MetricCard
            label={totals.profit >= 0 ? t.reports.netProfit : t.reports.netLoss}
            value={`${totals.profit >= 0 ? '+' : ''}${totals.profit.toFixed(0)}`} unit={cur}
            icon={Icons.wallet} tone={totals.profit >= 0 ? 'green' : 'red'}
            valueColor={totals.profit >= 0 ? '#059669' : '#dc2626'}
          />
          <MetricCard
            label={t.reports.avgMargin} value={totals.avgMargin.toFixed(1)} unit="%"
            icon={Icons.percent} tone={totals.avgMargin < 15 ? 'amber' : 'green'}
            valueColor={totals.avgMargin < 0 ? '#dc2626' : totals.avgMargin < 15 ? '#d97706' : '#059669'}
          />
          <MetricCard
            label={isAR ? 'مصروف الشراء' : 'Purchase spend'} value={totals.purchaseCost.toFixed(0)} unit={cur}
            icon={Icons.truck} tone="blue"
          />
        </div>

        {/* The comparison strip — the figures the cards above are measured against. */}
        <div className="rpt-deltas">
          {[
            { k: 'revenue' as const, label: isAR ? 'الإيراد' : 'Revenue', prev: previous.revenue },
            { k: 'cost' as const, label: isAR ? 'الكوست' : 'Cost', prev: previous.cost, invert: true },
            { k: 'profit' as const, label: isAR ? 'الربح' : 'Profit', prev: previous.profit },
            { k: 'purchaseCost' as const, label: isAR ? 'الشراء' : 'Spend', prev: previous.purchaseCost, invert: true },
          ].map(({ k, label, prev, invert }) => (
            <div key={k} className="rpt-delta">
              <span className="rpt-delta-label">{label}</span>
              <Delta pct={change[k]} lang={lang} invert={invert} />
              <span className="num rpt-delta-prev">{prev.toFixed(0)} {cur}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>
            <span className="ico-md" style={{ color: '#16a679' }}>{Icons.trendUp}</span>
            {isAR ? 'حركة المبيعات' : 'Sales over time'}
          </div>
          <SalesChart3D points={daily} lang={lang} currency={cur} />
        </div>

        {/* Pricing warnings */}
        {warnings.length > 0 && (
          <div className="card rpt-warn">
            <div className="card-title" style={{ marginBottom: 12 }}>
              <span className="ico-md" style={{ color: '#d97706' }}>{Icons.alert}</span>
              {isAR ? 'منتجات سعرها يحتاج مراجعة' : 'Products that need a price review'}
            </div>
            <div className="rpt-warn-list">
              {warnings.map(w => (
                <div key={w.name} className="rpt-warn-row">
                  <span style={{ fontWeight: 600 }}>{w.name}</span>
                  <span className="num rpt-warn-fig">
                    {isAR ? 'الكوست' : 'cost'} {w.unitCost.toFixed(2)}
                    {' · '}
                    {w.kind === 'no_price'
                      ? (isAR ? 'بدون سعر بيع' : 'no sell price')
                      : `${isAR ? 'السعر' : 'price'} ${w.sellPrice.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            <span className="ico-md" style={{ color: '#7c3aed' }}>{Icons.factory}</span>
            {isAR ? 'الإنتاج في هذه الفترة' : 'Production in this period'}
          </div>
          {prodSummary.length === 0 ? (
            <div className="tbl-empty" style={{ padding: '18px 0' }}>
              {isAR ? 'لا يوجد إنتاج في هذه الفترة' : 'No production in this period'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              {prodSummary.map((p, i) => (
                <div key={i} style={{ background: '#f9fafb', border: '1px solid #f1f5f9', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 5, fontWeight: 500 }}>{p.recipe_name}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>
                    {p.total} <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500 }}>{p.output_unit}</span>
                  </div>
                  <div className="num" style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 500 }}>
                    {isAR ? 'كوست:' : 'Cost:'} {(p.totalCost || 0).toFixed(1)} {cur}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="rpt-tblhead">
            <span className="card-title">
              {isAR ? 'تفصيل المنتجات' : 'Product breakdown'}
              <span className="rpt-count num">{totals.productsSold} · {totals.unitsSold} {isAR ? 'وحدة' : 'units'}</span>
            </span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {([
                ['profit', isAR ? 'ربح' : 'Profit'],
                ['margin', isAR ? 'هامش' : 'Margin'],
                ['revenue', isAR ? 'إيراد' : 'Revenue'],
                ['qty', isAR ? 'مباع' : 'Sold'],
                ['cost', isAR ? 'كوست' : 'Cost'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)} className={`rpt-sort${sort === k ? ' on' : ''}`}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              <div className="thead" style={{ gridTemplateColumns: COLS, gap: 8, borderTop: '1px solid #e5e7eb' }}>
                <span>#</span>
                <span>{isAR ? 'المنتج' : 'Product'}</span>
                <span>{isAR ? 'الكوست' : 'Cost'}</span>
                <span>{isAR ? 'السعر' : 'Price'}</span>
                <span>{isAR ? 'مباع' : 'Sold'}</span>
                <span>{isAR ? 'الإيراد' : 'Revenue'}</span>
                <span>{isAR ? 'الربح' : 'Profit'}</span>
                <span>{isAR ? 'الحصة' : 'Share'}</span>
              </div>

              {sorted.length === 0 ? (
                <div className="tbl-empty">{isAR ? 'لا توجد مبيعات في هذه الفترة' : 'No sales in this period'}</div>
              ) : sorted.map((d, i) => {
                const pc = d.profit < 0 ? '#dc2626' : d.profit === 0 ? '#9ca3af' : '#059669'
                const mc = d.margin === null ? null : d.margin < 0 ? 'tag-red' : d.margin < 15 ? 'tag-yellow' : 'tag-green'
                const trend = d.prevQty === null ? null : d.qty - d.prevQty
                return (
                  <div key={d.name} className="trow" style={{ gridTemplateColumns: COLS, gap: 8 }}>
                    <span className="num" style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, minWidth: 0 }}>
                      {d.name}
                      {mc && <span className={`tag ${mc}`} style={{ fontSize: 10, marginInlineStart: 6 }}>{d.margin?.toFixed(0)}%</span>}
                    </span>
                    <span className="num" style={{ fontSize: 12.5, color: '#6b7280' }}>{d.unitCost.toFixed(3)}</span>
                    <span className="num" style={{ fontSize: 12.5 }}>{d.sellPrice > 0 ? d.sellPrice.toFixed(2) : '—'}</span>
                    <span className="num" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {d.qty}
                      {trend !== null && trend !== 0 && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: trend > 0 ? '#059669' : '#dc2626' }}>
                          {trend > 0 ? '▲' : '▼'}{Math.abs(trend)}
                        </span>
                      )}
                    </span>
                    <span className="num" style={{ fontSize: 12.5 }}>{d.revenue.toFixed(0)}</span>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: pc }}>{d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span className="bar-wrap" style={{ flex: 1 }}>
                        <span className="bar-fill" style={{ display: 'block', width: `${d.share}%`, background: '#16a679' }} />
                      </span>
                      <span className="num" style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 600 }}>{d.share.toFixed(0)}%</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Best and worst, always by profit */}
        {byProfit.length > 0 && (
          <div className="rpt-ranks">
            {[
              { title: t.reports.topProducts, icon: Icons.trendUp, tint: '#059669', list: byProfit.slice(0, 3), isTop: true },
              { title: t.reports.botProducts, icon: Icons.trendDown, tint: '#d97706', list: byProfit.slice(-3).reverse(), isTop: false },
            ].map(({ title, icon, tint, list, isTop }) => (
              <div key={title} className="card">
                <div className="card-title" style={{ marginBottom: 14 }}>
                  <span className="ico-md" style={{ color: tint }}>{icon}</span>{title}
                </div>
                {list.map((d, i) => {
                  const pct = Math.round(Math.abs(d.profit) / maxProfit * 100)
                  const c = d.profit < 0 ? '#ef4444' : isTop ? '#16a679' : '#f59e0b'
                  const pc = d.profit < 0 ? '#dc2626' : isTop ? '#059669' : '#d97706'
                  return (
                    <div key={d.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontWeight: 500 }}>
                          <span className="num" style={{ color: '#d1d5db', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>{d.name}
                        </span>
                        <span className="num" style={{ fontWeight: 700, color: pc, whiteSpace: 'nowrap' }}>
                          {d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)} {cur}
                        </span>
                      </div>
                      <div className="bar-wrap"><div className="bar-fill" style={{ width: `${pct}%`, background: c }} /></div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .rpt-bar {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap; justify-content: space-between;
        }
        .rpt-presets { display: flex; gap: 6px; flex-wrap: wrap }
        .rpt-chip {
          display: inline-flex; align-items: center;
          background: #f8fafc; border: 1.5px solid transparent; color: #64748b;
          border-radius: 99px; padding: 6px 14px;
          font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .rpt-chip:hover { background: #eef2f7; color: #334155 }
        .rpt-chip.on { background: rgba(22,166,121,.1); border-color: #16a679; color: #0f7a5c }
        .rpt-actions { display: flex; gap: 6px }
        .rpt-act { font-size: 12.5px; padding: 6px 13px; display: inline-flex; align-items: center; gap: 6px }

        .rpt-custom {
          display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;
          width: 100%; padding-top: 12px; margin-top: 2px; border-top: 1px solid #f1f5f9;
        }
        .rpt-custom label { display: flex; flex-direction: column; gap: 5px; font-size: 11.5px; color: #64748b; font-weight: 600 }
        .rpt-custom input {
          border: 1.5px solid #e2e8f0; border-radius: 9px; padding: 7px 11px;
          font-size: 13px; font-family: inherit; color: #0b0f1a;
        }

        .rpt-period {
          display: flex; justify-content: space-between; align-items: baseline;
          gap: 10px; flex-wrap: wrap; padding: 0 2px;
        }
        .rpt-period-main {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 14px; font-weight: 700; color: #0b0f1a;
        }
        .rpt-days {
          background: #f1f5f9; color: #64748b; border-radius: 99px;
          padding: 2px 9px; font-size: 10.5px; font-weight: 700;
        }
        .rpt-period-sub { font-size: 11.5px; color: #94a3b8; font-weight: 500 }
        .rpt-sep { color: #e2e8f0; margin: 0 7px }

        .rpt-metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px }
        .rpt-deltas {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
          background: #fff; border: 1px solid #eaecf0; border-radius: var(--radius-lg);
          padding: 12px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .rpt-delta { display: flex; flex-direction: column; gap: 3px; min-width: 0 }
        .rpt-delta-label { font-size: 11px; color: #94a3b8; font-weight: 600 }
        .rpt-delta-prev { font-size: 10.5px; color: #cbd5e1; font-weight: 600 }

        .rpt-warn { border-color: #fde68a; background: #fffdf5 }
        .rpt-warn-list { display: flex; flex-direction: column; gap: 8px }
        .rpt-warn-row {
          display: flex; justify-content: space-between; align-items: center; gap: 10px;
          font-size: 13px; padding: 8px 12px; background: #fff;
          border: 1px solid #fef3c7; border-radius: 9px;
        }
        .rpt-warn-fig { font-size: 11.5px; color: #b45309; font-weight: 600; white-space: nowrap }

        .rpt-tblhead {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 18px 14px; flex-wrap: wrap; gap: 8px;
        }
        .rpt-count { font-size: 11px; color: #cbd5e1; font-weight: 600; margin-inline-start: 8px }
        .rpt-sort {
          background: #f8fafc; border: 1.5px solid transparent; color: #64748b;
          border-radius: 99px; padding: 4px 12px;
          font-size: 11.5px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .rpt-sort.on { background: rgba(22,166,121,.1); border-color: #16a679; color: #0f7a5c }

        .rpt-ranks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px }

        @media (max-width: 900px) {
          .rpt-metrics { grid-template-columns: repeat(2, 1fr) }
          .rpt-ranks { grid-template-columns: 1fr }
        }
        @media (max-width: 520px) {
          .rpt-metrics { grid-template-columns: 1fr }
          .rpt-deltas { grid-template-columns: repeat(2, 1fr); row-gap: 14px }
          .rpt-bar { justify-content: flex-start }
        }

        /* Printing is how this reaches an accountant, so the controls go and the
           cards stop trying to float off the page. */
        @media print {
          .rpt-bar, .rpt-actions, .rpt-custom { display: none !important }
          .card { box-shadow: none !important; break-inside: avoid }
          .rpt-metrics { grid-template-columns: repeat(5, 1fr) }
        }
      `}</style>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
  const guard = await requirePage(req as any, { anyPerm: ['reports'] })
  if (isRedirect(guard)) return guard
  const { user } = guard

  // Built by the same helper /api/reports uses — including the range, so the
  // first paint and every refresh after it describe the same period. The two
  // used to compute the metric cards differently (this one from recipe cost,
  // the API from the purchases table), so the auto-refresh silently swapped
  // one figure for the other.
  const initial = await buildReport(user.bakery_id, query)

  return { props: { user, initial } }
}
