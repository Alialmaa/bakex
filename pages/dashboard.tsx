import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { listSales, getWeeklySales } from '../lib/db/sales'
import { listStock } from '../lib/db/stock'
import { listProduction } from '../lib/db/production'
import { countPendingUsers } from '../lib/db/users'
import { getPurchaseCostInRange } from '../lib/db/purchases'
import { listRecipes } from '../lib/db/recipes'

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
  const metricBg = profitPositive ? '#E1F5EE' : '#FCEBEB'
  const metricColor = profitPositive ? '#085041' : '#A32D2D'

  const maxWeekly = Math.max(...weeklySales.map(d => d.total), 1)
  const maxTop = Math.max(...topProducts.map(p => p.revenue), 1)

  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString(isAR ? 'ar-SA' : 'en', { weekday: 'short' })
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* New bakery welcome banner — client-only to avoid hydration mismatch */}
        {isNew && (
          <div style={{ background: '#E1F5EE', border: '0.5px solid #1D9E75', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎉</span>
            <div style={{ fontSize: 13, color: '#085041' }}>
              {isAR
                ? `مرحباً بك في بيكريتك "${user.bakery_name}"! كود الانضمام: ${bakeryCode}`
                : `Welcome to "${user.bakery_name}"! Join code: ${bakeryCode}`}
            </div>
          </div>
        )}

        {/* Pending users banner */}
        {user.perms?.users && pendingCount > 0 && (
          <div style={{ background: '#FAEEDA', border: '0.5px solid #FAC775', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: '#854F0B' }}>
              🔔 {isAR ? `${pendingCount} طلب إنشاء حساب بانتظار الموافقة` : `${pendingCount} pending account request(s)`}
            </div>
            <a href="/users" style={{ fontSize: 12, color: '#854F0B', fontWeight: 500 }}>
              {isAR ? 'مراجعة الآن →' : 'Review now →'}
            </a>
          </div>
        )}

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div className="metric">
            <div className="metric-label">{t.dashboard.todaySales}</div>
            <div className="metric-value">{stats.todayRev.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span></div>
          </div>
          <div className="metric">
            <div className="metric-label">{t.dashboard.monthRev}</div>
            <div className="metric-value">{stats.monthRev.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span></div>
          </div>
          <div style={{ background: metricBg, borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: metricColor }}>{t.dashboard.monthProfit}</div>
            <div className="metric-value" style={{ color: metricColor }}>
              {profitPositive ? '+' : ''}{stats.monthProfit.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{cur}</span>
            </div>
            <div style={{ fontSize: 10, color: metricColor, marginTop: 2, opacity: 0.8 }}>
              {isAR ? `تكلفة: ${stats.monthCost.toFixed(0)} ${cur}` : `Cost: ${stats.monthCost.toFixed(0)} ${cur}`}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">{t.dashboard.lowStock}</div>
            <div className="metric-value" style={{ color: stats.lowStock > 0 ? '#A32D2D' : '#3B6D11' }}>{stats.lowStock}</div>
          </div>
        </div>

        {/* Weekly Sales Chart */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            📈 {isAR ? 'مبيعات آخر 7 أيام' : 'Last 7 Days Sales'}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {weeklySales.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, color: '#888' }}>{d.total > 0 ? d.total.toFixed(0) : ''}</div>
                <div style={{
                  width: '100%',
                  height: Math.max(4, (d.total / maxWeekly) * 60),
                  background: d.total > 0 ? '#1D9E75' : '#e5e5e5',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s',
                }} />
                <div style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap' }}>{dayLabel(d.day)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Top Products */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
              🏆 {isAR ? 'أعلى المنتجات مبيعاً' : 'Top Products'}
            </div>
            {topProducts.length === 0
              ? <div style={{ color: '#888', fontSize: 13 }}>{isAR ? 'لا توجد مبيعات بعد' : 'No sales yet'}</div>
              : topProducts.map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{p.name}</span>
                    <span style={{ color: '#888' }}>{p.revenue.toFixed(0)} {cur}</span>
                  </div>
                  <div style={{ background: '#f0f0ee', borderRadius: 3, height: 5 }}>
                    <div style={{ width: `${(p.revenue / maxTop) * 100}%`, height: '100%', background: '#1D9E75', borderRadius: 3 }} />
                  </div>
                </div>
              ))
            }
          </div>

          {/* Alerts + Recent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🔔 {t.dashboard.alerts}</div>
              {alerts.length === 0
                ? <div style={{ color: '#888', fontSize: 13 }}>{isAR ? 'كل شيء تمام ✓' : 'All good ✓'}</div>
                : alerts.map((a, i) => (
                  <div key={i} className={`alert alert-${a.type}`}>{a.msg}</div>
                ))
              }
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🕐 {t.dashboard.recentOps}</div>
              {recentLog.length === 0
                ? <div style={{ color: '#888', fontSize: 13 }}>{isAR ? 'لا توجد عمليات' : 'No activity'}</div>
                : recentLog.slice(0, 3).map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 12 }}>
                    <span>{l.label}</span>
                    <span style={{ color: '#888' }}>{new Date(l.created_at).toLocaleTimeString(isAR ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75' }} />
          {t.systemLive}
        </div>

        {/* Debug info - shows active session bakery */}
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 4, fontFamily: 'monospace' }} suppressHydrationWarning>
          session: {user?.username} | bakery_id: {user?.bakery_id ?? 'null'} | bakery: {user?.bakery_name ?? '—'}
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (user.role === 'super_admin') return { redirect: { destination: '/bakeries', permanent: false } }
  if (!user.perms?.dashboard) return { redirect: { destination: '/cashier', permanent: false } }

  const bakery_id = user.bakery_id
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  const [todaySales, monthSales, stock, prodLog, pendingCount, weeklySales, monthCost, recipes] = await Promise.all([
    listSales(bakery_id, today),
    listSales(bakery_id, monthStart),
    listStock(bakery_id),
    listProduction(bakery_id),
    user.perms?.users ? countPendingUsers(bakery_id) : Promise.resolve(0),
    getWeeklySales(bakery_id),
    getPurchaseCostInRange(bakery_id, monthStart),
    listRecipes(bakery_id),
  ])

  const todayRev = (todaySales || []).reduce((s: number, r: any) => s + r.total, 0)
  const monthRev = (monthSales || []).reduce((s: number, r: any) => s + r.total, 0)
  const monthProfit = monthRev - monthCost
  const lowStock = (stock || []).filter((m: any) => m.qty < m.min_qty).length

  const alertsList = (stock || [])
    .filter((m: any) => m.qty < m.min_qty)
    .slice(0, 4)
    .map((m: any) => ({
      type: m.qty === 0 ? 'error' : 'warn',
      msg: `${m.name}: ${m.qty} ${m.unit} (min: ${m.min_qty})`
    }))

  const recentLog = (prodLog || [])
    .slice(0, 5)
    .map((l: any) => ({ ...l, label: `${l.recipe_name} × ${l.output_qty} ${l.output_unit}` }))

  // Top products by revenue this month
  const recipeMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  for (const r of recipes || []) recipeMap[r.id] = { name: r.name, qty: 0, revenue: 0 }
  for (const s of monthSales || []) {
    if (recipeMap[s.recipe_id]) {
      recipeMap[s.recipe_id].qty += s.qty
      recipeMap[s.recipe_id].revenue += s.total
    }
  }
  const topProducts = Object.values(recipeMap)
    .filter(p => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return {
    props: {
      user,
      stats: { todayRev, monthRev, monthProfit, monthCost, lowStock },
      alerts: alertsList,
      recentLog,
      pendingCount,
      weeklySales,
      topProducts,
    }
  }
}
