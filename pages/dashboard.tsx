import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import Layout from '../components/Layout'
import { MetricCard, Icons } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { getWeeklySales, getSalesRevenue, getSalesByRecipe } from '../lib/db/sales'
import { getLowStockCount, listLowStock } from '../lib/db/stock'
import { listProduction } from '../lib/db/production'
import { countPendingUsers } from '../lib/db/users'
import { getPurchaseCostInRange } from '../lib/db/purchases'
import { listRecipes } from '../lib/db/recipes'
import { fmtDate, fmtTime } from '../lib/datetime'

interface WeekDay { day: string; total: number }
interface TopProduct { name: string; qty: number; revenue: number }
interface Props {
  user: any
  stats: { todayRev: number; monthRev: number; monthProfit: number; monthCost: number; lowStock: number }
  alerts: any[]
  recentLog: any[]
  pendingCount: number
  weeklySales: WeekDay[]
  topProducts: TopProduct[]
}


export default function Dashboard({ user, stats, alerts, recentLog, pendingCount, weeklySales, topProducts }: Props) {
  const { lang, setLang } = useLang()
  const t = T[lang]
  const isAR = lang === 'ar'
  const cur = t.currency

  const [isNew, setIsNew] = useState(false)
  const [bakeryCode, setBakeryCode] = useState('')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('new') === '1') { setIsNew(true); setBakeryCode(p.get('bakery') || '') }
  }, [])

  const profitPositive = stats.monthProfit >= 0
  const maxWeekly = Math.max(...weeklySales.map(d => d.total), 1)
  const maxTop = Math.max(...topProducts.map(p => p.revenue), 1)

  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return fmtDate(d, lang, { weekday: 'short' })
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {isNew && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="ico-md" style={{ color: '#059669', flexShrink: 0 }}>{Icons.sparkle}</span>
            <div style={{ fontSize: 13, color: '#065f46', fontWeight: 500 }}>
              {isAR
                ? `مرحباً بك في بيكريتك "${user.bakery_name}"! كود الانضمام: ${bakeryCode}`
                : `Welcome to "${user.bakery_name}"! Join code: ${bakeryCode}`}
            </div>
          </div>
        )}

        {user.perms?.users && pendingCount > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#92400e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="ico-sm" style={{ color: '#d97706', flexShrink: 0 }}>{Icons.bell}</span>
              {isAR ? `${pendingCount} طلب إنشاء حساب بانتظار الموافقة` : `${pendingCount} pending account request(s)`}
            </div>
            <a href="/users" style={{ fontSize: 12.5, color: '#92400e', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {isAR ? 'مراجعة الآن ←' : 'Review now →'}
            </a>
          </div>
        )}

        {/* KPI Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <MetricCard
            label={t.dashboard.todaySales}
            value={stats.todayRev.toFixed(0)}
            unit={cur}
            sub={isAR ? 'إيراد اليوم الحالي' : 'revenue so far today'}
            icon={Icons.cart} tone="green"
          />
          <MetricCard
            label={t.dashboard.monthRev}
            value={stats.monthRev.toFixed(0)}
            unit={cur}
            sub={isAR ? 'إيراد الشهر الحالي' : 'revenue this month'}
            icon={Icons.trendUp} tone="blue"
          />
          <MetricCard
            label={t.dashboard.monthProfit}
            value={(profitPositive ? '+' : '') + stats.monthProfit.toFixed(0)}
            unit={cur}
            sub={isAR ? `تكلفة: ${stats.monthCost.toFixed(0)} ${cur}` : `Cost: ${stats.monthCost.toFixed(0)} ${cur}`}
            icon={profitPositive ? Icons.trendUp : Icons.trendDown}
            cardBg={profitPositive ? '#f0fdf4' : '#fef2f2'}
            cardBorder={profitPositive ? '#bbf7d0' : '#fecaca'}
            valueColor={profitPositive ? '#15803d' : '#b91c1c'}
            labelColor={profitPositive ? '#16a34a' : '#dc2626'}
            iconBg={profitPositive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)'}
            iconColor={profitPositive ? '#16a34a' : '#dc2626'}
          />
          <MetricCard
            label={t.dashboard.lowStock}
            value={stats.lowStock}
            sub={isAR ? 'مادة خام تحت الحد' : 'items below minimum'}
            icon={Icons.box}
            cardBg={stats.lowStock > 0 ? '#fffbeb' : '#fff'}
            cardBorder={stats.lowStock > 0 ? '#fde68a' : '#eaecf0'}
            valueColor={stats.lowStock > 0 ? '#d97706' : '#111827'}
            iconBg={stats.lowStock > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.08)'}
            iconColor={stats.lowStock > 0 ? '#d97706' : '#9ca3af'}
          />
        </div>

        {/* Weekly Sales Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="card-title">
              {isAR ? 'مبيعات آخر 7 أيام' : 'Last 7 Days Sales'}
            </div>
            <div className="num" style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>
              {isAR ? 'إجمالي' : 'Total'}: {weeklySales.reduce((s, d) => s + d.total, 0).toFixed(0)} {cur}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
            {weeklySales.map((d, i) => {
              const pct = d.total > 0 ? Math.max(8, (d.total / maxWeekly) * 88) : 6
              const isToday = i === weeklySales.length - 1
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  {d.total > 0 && (
                    <div className="num" style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{d.total.toFixed(0)}</div>
                  )}
                  <div style={{
                    width: '100%',
                    height: pct,
                    background: isToday ? '#16a679' : d.total > 0 ? 'rgba(22,166,121,0.35)' : '#e5e7eb',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                    marginTop: 'auto',
                  }} />
                  <div style={{ fontSize: 9.5, color: isToday ? '#16a679' : '#9ca3af', fontWeight: isToday ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {dayLabel(d.day)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Top Products */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>
              {isAR ? 'أعلى المنتجات مبيعاً' : 'Top Selling Products'}
            </div>
            {topProducts.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>{isAR ? 'لا توجد مبيعات بعد' : 'No sales yet'}</div>
              : topProducts.map((p, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{
                        width: 20, height: 20,
                        borderRadius: '50%',
                        background: i === 0 ? '#fef3c7' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: i === 0 ? '#d97706' : '#6b7280',
                        flexShrink: 0,
                      }}>
                        <span className="num">{i + 1}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                    <span className="num" style={{ color: '#6b7280', fontSize: 12.5, fontWeight: 600 }}>{p.revenue.toFixed(0)} {cur}</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 4, height: 5 }}>
                    <div style={{
                      width: `${(p.revenue / maxTop) * 100}%`,
                      height: '100%',
                      background: i === 0 ? '#16a679' : '#93c5fd',
                      borderRadius: 4,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))
            }
          </div>

          {/* Alerts + Recent Activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                {t.dashboard.alerts}
              </div>
              {alerts.length === 0
                ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a679', fontSize: 13 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {isAR ? 'كل شيء تمام' : 'All good'}
                  </div>
                )
                : alerts.map((a, i) => (
                  <div key={i} className={`alert alert-${a.type}`}>{a.msg}</div>
                ))
              }
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                {t.dashboard.recentOps}
              </div>
              {recentLog.length === 0
                ? <div style={{ color: '#9ca3af', fontSize: 13 }}>{isAR ? 'لا توجد عمليات' : 'No activity'}</div>
                : recentLog.slice(0, 3).map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a679', flexShrink: 0 }} />
                      <span style={{ color: '#374151' }}>{l.label}</span>
                    </div>
                    <span className="num" style={{ color: '#9ca3af', flexShrink: 0 }} suppressHydrationWarning>
                      {fmtTime(l.created_at, lang)}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#9ca3af' }} suppressHydrationWarning>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a679' }} />
          {t.systemLive} — {user?.username} · {user?.bakery_name ?? '—'}
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { anyPerm: ['dashboard'], denyTo: '/cashier', redirectSuperAdminTo: '/bakeries' })
  if (isRedirect(guard)) return guard
  const { user } = guard

  const bakery_id = user.bakery_id
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  // Totals are aggregates now. This used to fetch every sale for today AND for
  // the month, plus the entire production history, then reduce all of it here
  // just to display five numbers and a top-five list.
  const [todayRev, monthRev, lowStock, alertRows, recentLog, pendingCount,
         weeklySales, monthCost, recipes, salesByRecipe] = await Promise.all([
    getSalesRevenue(bakery_id, today),
    getSalesRevenue(bakery_id, monthStart),
    getLowStockCount(bakery_id),
    listLowStock(bakery_id, 4),
    listProduction(bakery_id, undefined, 5),
    user.perms?.users ? countPendingUsers(bakery_id) : Promise.resolve(0),
    getWeeklySales(bakery_id),
    getPurchaseCostInRange(bakery_id, monthStart),
    listRecipes(bakery_id),
    getSalesByRecipe(bakery_id, monthStart),
  ])

  const monthProfit = monthRev - monthCost

  const alertsList = (alertRows || []).map((m: any) => ({
    type: m.qty === 0 ? 'error' : 'warn',
    msg: `${m.name}: ${m.qty} ${m.unit} (min: ${m.min_qty})`,
  }))

  const activity = (recentLog || []).map((l: any) => ({
    ...l,
    label: `${l.recipe_name} × ${l.output_qty} ${l.output_unit}`,
  }))

  const topProducts = (recipes || [])
    .map((r: any) => {
      const agg = salesByRecipe.get(r.id)
      return { name: r.name, qty: agg?.qty ?? 0, revenue: agg?.revenue ?? 0 }
    })
    .filter((p: any) => p.revenue > 0)
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5)

  return {
    props: {
      user,
      stats: { todayRev, monthRev, monthProfit, monthCost, lowStock },
      alerts: alertsList,
      recentLog: activity,
      pendingCount,
      weeklySales,
      topProducts,
    }
  }
}
