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

const IconCart = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
)

const IconTrendUp = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const IconTrendDown = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
    <polyline points="17 18 23 18 23 12"/>
  </svg>
)

const IconDollar = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)

const IconBox = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

function MetricCard({
  label, value, unit, subtext, icon, iconBg, iconColor, cardBg, cardBorder, valueColor, labelColor
}: {
  label: string; value: string; unit?: string; subtext?: string
  icon: React.ReactNode; iconBg: string; iconColor?: string
  cardBg?: string; cardBorder?: string; valueColor?: string; labelColor?: string
}) {
  return (
    <div style={{
      background: cardBg ?? '#fff',
      border: `1px solid ${cardBorder ?? '#eaecf0'}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: labelColor ?? '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 10,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          color: valueColor ?? '#111827',
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          {value}
          {unit && <span style={{ fontSize: 13, fontWeight: 400, color: valueColor ? valueColor : '#6b7280', marginInlineStart: 5 }}>{unit}</span>}
        </div>
        {subtext && (
          <div style={{ fontSize: 11, color: labelColor ?? '#9ca3af', marginTop: 7 }}>{subtext}</div>
        )}
      </div>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  )
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
    return d.toLocaleDateString(isAR ? 'ar-SA' : 'en', { weekday: 'short' })
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

        {/* KPI Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <MetricCard
            label={t.dashboard.todaySales}
            value={stats.todayRev.toFixed(0)}
            unit={cur}
            iconBg="rgba(22,166,121,0.1)"
            icon={<IconCart color="#16a679" />}
          />
          <MetricCard
            label={t.dashboard.monthRev}
            value={stats.monthRev.toFixed(0)}
            unit={cur}
            iconBg="rgba(59,130,246,0.1)"
            icon={<IconTrendUp color="#3b82f6" />}
          />
          <MetricCard
            label={t.dashboard.monthProfit}
            value={(profitPositive ? '+' : '') + stats.monthProfit.toFixed(0)}
            unit={cur}
            subtext={isAR ? `تكلفة: ${stats.monthCost.toFixed(0)} ${cur}` : `Cost: ${stats.monthCost.toFixed(0)} ${cur}`}
            cardBg={profitPositive ? '#f0fdf4' : '#fef2f2'}
            cardBorder={profitPositive ? '#bbf7d0' : '#fecaca'}
            valueColor={profitPositive ? '#15803d' : '#b91c1c'}
            labelColor={profitPositive ? '#16a34a' : '#dc2626'}
            iconBg={profitPositive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)'}
            icon={profitPositive ? <IconTrendUp color="#16a34a" /> : <IconTrendDown color="#dc2626" />}
          />
          <MetricCard
            label={t.dashboard.lowStock}
            value={String(stats.lowStock)}
            subtext={isAR ? 'مادة خام تحت الحد' : 'items below minimum'}
            cardBg={stats.lowStock > 0 ? '#fffbeb' : '#fff'}
            cardBorder={stats.lowStock > 0 ? '#fde68a' : '#eaecf0'}
            valueColor={stats.lowStock > 0 ? '#d97706' : '#111827'}
            iconBg={stats.lowStock > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.08)'}
            icon={<IconBox color={stats.lowStock > 0 ? '#d97706' : '#9ca3af'} />}
          />
        </div>

        {/* Weekly Sales Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {isAR ? 'مبيعات آخر 7 أيام' : 'Last 7 Days Sales'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
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
                    <div style={{ fontSize: 9.5, color: '#6b7280', fontWeight: 500 }}>{d.total.toFixed(0)}</div>
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
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 14 }}>
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
                        {i + 1}
                      </div>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{p.revenue.toFixed(0)} {cur}</span>
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
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 10 }}>
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
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 10 }}>
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
                    <span style={{ color: '#9ca3af', flexShrink: 0 }}>
                      {new Date(l.created_at).toLocaleTimeString(isAR ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}
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
