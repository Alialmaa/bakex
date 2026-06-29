import { useState, useEffect, useCallback } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            🔄 {lang === 'ar' ? 'آخر تحديث:' : 'Last update:'} {lastUpdated.toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            <span style={{ marginRight: 8, marginLeft: 8, color: '#ccc' }}>|</span>
            {lang === 'ar' ? 'يتحدث تلقائياً كل 30 ثانية' : 'Auto-refreshes every 30s'}
          </div>
          <button onClick={fetchData} disabled={refreshing} className="btn" style={{ fontSize: 12, padding: '5px 12px' }}>
            {refreshing ? '...' : (lang === 'ar' ? '↻ تحديث الآن' : '↻ Refresh')}
          </button>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div className="metric"><div className="metric-label">{t.reports.totalRev}</div><div className="metric-value">{totals.revenue.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span></div></div>
          <div className="metric"><div className="metric-label">{t.reports.totalCost}</div><div className="metric-value" style={{ color: '#A32D2D' }}>{totals.cost.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span></div></div>
          <div style={{ background: totals.profit >= 0 ? '#E1F5EE' : '#FCEBEB', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: totals.profit >= 0 ? '#0F6E56' : '#A32D2D' }}>{totals.profit >= 0 ? t.reports.netProfit : t.reports.netLoss}</div>
            <div className="metric-value" style={{ color: totals.profit >= 0 ? '#085041' : '#A32D2D' }}>{totals.profit >= 0 ? '+' : ''}{totals.profit.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span></div>
          </div>
          <div className="metric"><div className="metric-label">{t.reports.avgMargin}</div><div className="metric-value" style={{ color: totals.avgMargin < 15 ? '#854F0B' : '#3B6D11' }}>{totals.avgMargin.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400 }}>%</span></div></div>
        </div>

        {/* Production summary */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
            🏭 {lang === 'ar' ? 'ملخص الإنتاج هذا الشهر' : 'Production this Month'}
          </div>
          {prodSummary.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
              {lang === 'ar' ? 'لا يوجد إنتاج هذا الشهر' : 'No production this month'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {prodSummary.map((p: any, i: number) => (
                <div key={i} style={{ background: '#f5f5f3', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>{p.recipe_name}</div>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{p.total} <span style={{ fontSize: 11, color: '#888' }}>{p.output_unit}</span></div>
                  <div style={{ fontSize: 10, color: '#3B6D11', marginTop: 2 }}>{lang === 'ar' ? 'كوست:' : 'Cost:'} {(p.totalCost || 0).toFixed(1)} {cur}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{lang === 'ar' ? 'تفصيل المنتجات' : 'Product Breakdown'}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['profit', 'margin', 'cost'] as const).map(s => (
                <button key={s} onClick={() => setSort(s)} className={`tag ${s === 'profit' ? 'tag-green' : s === 'margin' ? 'tag-yellow' : 'tag-red'}`} style={{ cursor: 'pointer', border: sort === s ? '1.5px solid #1D9E75' : '1.5px solid transparent', padding: '3px 10px' }}>
                  {s === 'profit' ? (lang === 'ar' ? 'ربح' : 'Profit') : s === 'margin' ? (lang === 'ar' ? 'هامش' : 'Margin') : (lang === 'ar' ? 'كوست' : 'Cost')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '22px 1.5fr 80px 80px 70px 80px 80px', gap: 8, padding: '6px 0 8px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <span>#</span><span>{lang === 'ar' ? 'المنتج' : 'Product'}</span><span>{lang === 'ar' ? 'الكوست' : 'Cost'}</span><span>{lang === 'ar' ? 'السعر' : 'Price'}</span><span>{lang === 'ar' ? 'مباع' : 'Sold'}</span><span>{lang === 'ar' ? 'الإيراد' : 'Revenue'}</span><span>{lang === 'ar' ? 'الربح' : 'Profit'}</span>
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
              {lang === 'ar' ? 'لا توجد بيانات مبيعات هذا الشهر' : 'No sales data this month'}
            </div>
          ) : sorted.map((d: any, i: number) => {
            const pc = d.profit < 0 ? '#A32D2D' : d.profit === 0 ? '#888' : '#3B6D11'
            const mc = d.margin === null ? null : d.margin < 0 ? 'tag-red' : d.margin < 15 ? 'tag-yellow' : 'tag-green'
            return (
              <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '22px 1.5fr 80px 80px 70px 80px 80px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                <span style={{ color: '#888', fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontWeight: 500 }}>{d.name}{mc && <span className={`tag ${mc}`} style={{ fontSize: 10, marginRight: 6, marginLeft: 6 }}>{d.margin?.toFixed(0)}%</span>}</span>
                <span style={{ fontSize: 12 }}>{d.unitCost.toFixed(3)}</span>
                <span style={{ fontSize: 12 }}>{d.sellPrice > 0 ? d.sellPrice.toFixed(2) : '—'}</span>
                <span style={{ fontSize: 12 }}>{d.qty}</span>
                <span style={{ fontSize: 12 }}>{d.revenue.toFixed(0)}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: pc }}>{d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)}</span>
              </div>
            )
          })}
        </div>

        {/* Top/Bot */}
        {sorted.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { title: t.reports.topProducts, icon: '🏆', list: [...sorted].slice(0, 3), isTop: true },
              { title: t.reports.botProducts, icon: '📉', list: [...sorted].reverse().slice(0, 3), isTop: false }
            ].map(({ title, icon, list, isTop }) => (
              <div key={title} className="card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{icon} {title}</div>
                {list.map((d: any, i: number) => {
                  const pct = Math.round(Math.abs(d.profit) / maxProfit * 100)
                  const c = d.profit < 0 ? '#E24B4A' : isTop ? '#1D9E75' : '#EF9F27'
                  const pc = d.profit < 0 ? '#A32D2D' : isTop ? '#3B6D11' : '#854F0B'
                  return (
                    <div key={d.name} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#aaa', fontSize: 11 }}>{i + 1}</span>{d.name}</span>
                        <span style={{ fontWeight: 500, color: pc }}>{d.profit >= 0 ? '+' : ''}{d.profit.toFixed(0)} {cur}</span>
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
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.reports) return { redirect: { destination: '/', permanent: false } }

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
