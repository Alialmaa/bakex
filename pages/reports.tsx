import { useState, useEffect, useCallback } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { fmtTime } from '../lib/datetime'

const COLS = '26px 1.5fr 80px 80px 70px 80px 80px'

export default function ReportsPage({ user, initialData, initialTotals, initialProdSummary }: any) {
  const { lang, setLang } = useLang()
  const [sort, setSort] = useState<'profit' | 'margin' | 'cost'>('profit')
  const [data, setData] = useState(initialData || [])
  const [totals, setTotals] = useState(initialTotals || { revenue: 0, cost: 0, profit: 0, avgMargin: 0 })
  const [prodSummary, setProdSummary] = useState(initialProdSummary || [])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const t = T[lang]
  const cur = t.currency

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/reports')
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
        setTotals(json.totals)
        setProdSummary(json.prodSummary)
        setLastUpdated(new Date())
      }
    } finally { setRefreshing(false) }
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const sorted = [...data].sort((a: any, b: any) => {
    if (sort === 'profit') return b.profit - a.profit
    if (sort === 'margin') return (b.margin ?? -999) - (a.margin ?? -999)
    return b.unitCost - a.unitCost
  })

  const maxProfit = Math.max(...sorted.map((d: any) => Math.abs(d.profit)), 1)

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header with refresh */}
        <div className="page-head">
          <div className="page-head-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a679', flexShrink: 0 }} />
            <span suppressHydrationWarning>
              {lang === 'ar' ? 'آخر تحديث:' : 'Last update:'} {fmtTime(lastUpdated, lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ color: '#e5e7eb' }}>|</span>
            {lang === 'ar' ? 'يتحدث تلقائياً كل 30 ثانية' : 'Auto-refreshes every 30s'}
          </div>
          <button onClick={fetchData} disabled={refreshing} className="btn" style={{ fontSize: 12.5, padding: '6px 14px' }}>
            {refreshing ? '...' : (lang === 'ar' ? '↻ تحديث الآن' : '↻ Refresh')}
          </button>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <MetricCard
            label={t.reports.totalRev} value={totals.revenue.toFixed(0)} unit={cur}
            sub={lang === 'ar' ? 'إيراد هذا الشهر' : 'revenue this month'}
            icon={Icons.trendUp} tone="green"
          />
          <MetricCard
            label={t.reports.totalCost} value={totals.cost.toFixed(0)} unit={cur}
            sub={lang === 'ar' ? 'كوست المنتجات المباعة' : 'cost of goods sold'}
            icon={Icons.trendDown} tone="red" valueColor="#dc2626"
          />
          <MetricCard
            label={totals.profit >= 0 ? t.reports.netProfit : t.reports.netLoss}
            value={`${totals.profit >= 0 ? '+' : ''}${totals.profit.toFixed(0)}`} unit={cur}
            sub={lang === 'ar' ? 'الإيراد ناقص الكوست' : 'revenue minus cost'}
            icon={Icons.wallet} tone={totals.profit >= 0 ? 'green' : 'red'}
            valueColor={totals.profit >= 0 ? '#059669' : '#dc2626'}
          />
          <MetricCard
            label={t.reports.avgMargin} value={totals.avgMargin.toFixed(1)} unit="%"
            sub={lang === 'ar' ? 'متوسط هامش الربح' : 'average profit margin'}
            icon={Icons.percent} tone={totals.avgMargin < 15 ? 'amber' : 'green'}
            valueColor={totals.avgMargin < 0 ? '#dc2626' : totals.avgMargin < 15 ? '#d97706' : '#059669'}
          />
        </div>

        {/* Production summary */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            <span className="ico-md" style={{ color: '#7c3aed' }}>{Icons.factory}</span>
            {lang === 'ar' ? 'ملخص الإنتاج هذا الشهر' : 'Production this Month'}
          </div>
          {prodSummary.length === 0 ? (
            <div className="tbl-empty" style={{ padding: '18px 0' }}>
              {lang === 'ar' ? 'لا يوجد إنتاج هذا الشهر' : 'No production this month'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {prodSummary.map((p: any, i: number) => (
                <div key={i} style={{ background: '#f9fafb', border: '1px solid #f1f5f9', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 5, fontWeight: 500 }}>{p.recipe_name}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>{p.total} <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500 }}>{p.output_unit}</span></div>
                  <div className="num" style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 500 }}>{lang === 'ar' ? 'كوست:' : 'Cost:'} {(p.totalCost || 0).toFixed(1)} {cur}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 14px', flexWrap: 'wrap', gap: 8 }}>
            <span className="card-title">{lang === 'ar' ? 'تفصيل المنتجات' : 'Product Breakdown'}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['profit', 'margin', 'cost'] as const).map(s => (
                <button key={s} onClick={() => setSort(s)} className={`tag ${s === 'profit' ? 'tag-green' : s === 'margin' ? 'tag-yellow' : 'tag-red'}`} style={{ cursor: 'pointer', border: sort === s ? '1.5px solid #16a679' : '1.5px solid transparent', padding: '3px 11px', fontWeight: 600 }}>
                  {s === 'profit' ? (lang === 'ar' ? 'ربح' : 'Profit') : s === 'margin' ? (lang === 'ar' ? 'هامش' : 'Margin') : (lang === 'ar' ? 'كوست' : 'Cost')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 620 }}>
              <div className="thead" style={{ gridTemplateColumns: COLS, gap: 8, borderTop: '1px solid #e5e7eb' }}>
                <span>#</span><span>{lang === 'ar' ? 'المنتج' : 'Product'}</span><span>{lang === 'ar' ? 'الكوست' : 'Cost'}</span><span>{lang === 'ar' ? 'السعر' : 'Price'}</span><span>{lang === 'ar' ? 'مباع' : 'Sold'}</span><span>{lang === 'ar' ? 'الإيراد' : 'Revenue'}</span><span>{lang === 'ar' ? 'الربح' : 'Profit'}</span>
              </div>

              {sorted.length === 0 ? (
                <div className="tbl-empty">
                  {lang === 'ar' ? 'لا توجد بيانات مبيعات هذا الشهر' : 'No sales data this month'}
                </div>
              ) : sorted.map((d: any, i: number) => {
                const pc = d.profit < 0 ? '#dc2626' : d.profit === 0 ? '#9ca3af' : '#059669'
                const mc = d.margin === null ? null : d.margin < 0 ? 'tag-red' : d.margin < 15 ? 'tag-yellow' : 'tag-green'
                return (
                  <div key={d.name} className="trow" style={{ gridTemplateColumns: COLS, gap: 8 }}>
                    <span className="num" style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, minWidth: 0 }}>{d.name}{mc && <span className={`tag ${mc}`} style={{ fontSize: 10, marginInlineStart: 6 }}>{d.margin?.toFixed(0)}%</span>}</span>
                    <span className="num" style={{ fontSize: 12.5, color: '#6b7280' }}>{d.unitCost.toFixed(3)}</span>
                    <span className="num" style={{ fontSize: 12.5 }}>{d.sellPrice > 0 ? d.sellPrice.toFixed(2) : '—'}</span>
                    <span className="num" style={{ fontSize: 12.5 }}>{d.qty}</span>
                    <span className="num" style={{ fontSize: 12.5 }}>{d.revenue.toFixed(0)}</span>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: pc }}>{d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Top/Bot */}
        {sorted.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { title: t.reports.topProducts, icon: Icons.trendUp, tint: '#059669', list: [...sorted].slice(0, 3), isTop: true },
              { title: t.reports.botProducts, icon: Icons.trendDown, tint: '#d97706', list: [...sorted].reverse().slice(0, 3), isTop: false }
            ].map(({ title, icon, tint, list, isTop }) => (
              <div key={title} className="card">
                <div className="card-title" style={{ marginBottom: 14 }}>
                  <span className="ico-md" style={{ color: tint }}>{icon}</span>{title}
                </div>
                {list.map((d: any, i: number) => {
                  const pct = Math.round(Math.abs(d.profit) / maxProfit * 100)
                  const c = d.profit < 0 ? '#ef4444' : isTop ? '#16a679' : '#f59e0b'
                  const pc = d.profit < 0 ? '#dc2626' : isTop ? '#059669' : '#d97706'
                  return (
                    <div key={d.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontWeight: 500 }}>
                          <span className="num" style={{ color: '#d1d5db', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>{d.name}
                        </span>
                        <span className="num" style={{ fontWeight: 700, color: pc, whiteSpace: 'nowrap' }}>{d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)} {cur}</span>
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
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { anyPerm: ['reports'] })
  if (isRedirect(guard)) return guard
  const { user } = guard

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'
  const bid = user.bakery_id
  const [{ data: sales }, { data: recipes }, { data: stock }, { data: prodLog }] = await Promise.all([
    bid ? supabaseAdmin.from('sales').select('*').eq('bakery_id', bid).gte('created_at', monthStart) : supabaseAdmin.from('sales').select('*').gte('created_at', monthStart),
    bid ? supabaseAdmin.from('recipes').select('*').eq('bakery_id', bid) : supabaseAdmin.from('recipes').select('*'),
    bid ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bid) : supabaseAdmin.from('stock').select('*'),
    bid ? supabaseAdmin.from('production_log').select('*').eq('bakery_id', bid).gte('created_at', monthStart) : supabaseAdmin.from('production_log').select('*').gte('created_at', monthStart),
  ])

  const getStk = (name: string) => (stock || []).find((s: any) => s.name === name)
  const getUnitCost = (recipe: any) => {
    const total = (recipe.ingredients || []).reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    const units = recipe.units_per_batch || recipe.output_qty || 1
    return units > 0 ? total / units : 0
  }

  const data = (recipes || []).map((r: any) => {
    const rSales = (sales || []).filter((s: any) => s.recipe_id === r.id)
    const qty = rSales.reduce((s: number, l: any) => s + l.qty, 0)
    const revenue = rSales.reduce((s: number, l: any) => s + l.total, 0)
    const unitCost = getUnitCost(r)
    const cost = unitCost * qty
    const profit = revenue - cost
    const margin = revenue > 0 ? (profit / revenue) * 100 : null
    return { name: r.name, qty, revenue, cost, profit, margin, unitCost, sellPrice: r.sell_price || 0 }
  })

  const prodMap: Record<string, any> = {}
  for (const l of (prodLog || [])) {
    if (!prodMap[l.recipe_id]) {
      const recipe = (recipes || []).find((r: any) => r.id === l.recipe_id)
      const unitCost = recipe ? getUnitCost(recipe) : 0
      prodMap[l.recipe_id] = { recipe_name: l.recipe_name, output_unit: l.output_unit, total: 0, unitCost, totalCost: 0 }
    }
    prodMap[l.recipe_id].total += l.output_qty
    prodMap[l.recipe_id].totalCost += l.output_qty * prodMap[l.recipe_id].unitCost
  }

  const totals = {
    revenue: data.reduce((s: number, d: any) => s + d.revenue, 0),
    cost: data.reduce((s: number, d: any) => s + d.cost, 0),
    profit: data.reduce((s: number, d: any) => s + d.profit, 0),
    avgMargin: 0,
  }
  totals.avgMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0

  return { props: { user, initialData: data, initialTotals: totals, initialProdSummary: Object.values(prodMap) } }
}
