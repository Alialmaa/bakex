import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T, Lang } from '../lib/translations'

interface Props { user: any; stats: any; alerts: any[]; recentLog: any[] }

export default function Dashboard({ user, stats, alerts, recentLog }: Props) {
  const [lang, setLang] = useState<Lang>('ar')
  const t = T[lang]
  const isAR = lang === 'ar'
  const cur = t.currency

  const metricBg = stats.monthProfit >= 0 ? '#E1F5EE' : '#FCEBEB'
  const metricColor = stats.monthProfit >= 0 ? '#085041' : '#A32D2D'

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          <div className="metric"><div className="metric-label">{t.dashboard.todaySales}</div><div className="metric-value">{stats.todayRev.toFixed(0)} <span style={{fontSize:12,fontWeight:400}}>{cur}</span></div></div>
          <div className="metric"><div className="metric-label">{t.dashboard.monthRev}</div><div className="metric-value">{stats.monthRev.toFixed(0)} <span style={{fontSize:12,fontWeight:400}}>{cur}</span></div></div>
          <div style={{ background:metricBg, borderRadius:8, padding:'12px 14px' }}>
            <div className="metric-label" style={{color:metricColor}}>{t.dashboard.monthProfit}</div>
            <div className="metric-value" style={{color:metricColor}}>{stats.monthProfit >= 0 ? '+' : ''}{stats.monthProfit.toFixed(0)} <span style={{fontSize:12,fontWeight:400}}>{cur}</span></div>
          </div>
          <div className="metric"><div className="metric-label">{t.dashboard.lowStock}</div><div className="metric-value" style={{color:stats.lowStock>0?'#A32D2D':'#3B6D11'}}>{stats.lowStock}</div></div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {/* Alerts */}
          <div className="card">
            <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>🔔 {t.dashboard.alerts}</div>
            {alerts.length === 0
              ? <div style={{color:'#888',fontSize:13}}>{isAR?'كل شيء تمام ✓':'All good ✓'}</div>
              : alerts.map((a,i) => (
                <div key={i} className={`alert alert-${a.type}`}>{a.msg}</div>
              ))
            }
          </div>
          {/* Recent */}
          <div className="card">
            <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>🕐 {t.dashboard.recentOps}</div>
            {recentLog.length === 0
              ? <div style={{color:'#888',fontSize:13}}>{isAR?'لا توجد عمليات':'No recent activity'}</div>
              : recentLog.map((l,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid #e5e5e5',fontSize:12}}>
                  <span>{l.label}</span>
                  <span style={{color:'#888'}}>{new Date(l.created_at).toLocaleTimeString(isAR?'ar':'en',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* System live badge */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#888' }}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75'}}></div>
          {t.systemLive}
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.dashboard) return { redirect: { destination: '/login', permanent: false } }

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  const [{ data: todaySales }, { data: monthSales }, { data: stock }, { data: prodLog }] = await Promise.all([
    supabaseAdmin.from('sales').select('total').gte('created_at', today),
    supabaseAdmin.from('sales').select('total, recipe_id').gte('created_at', monthStart),
    supabaseAdmin.from('stock').select('*'),
    supabaseAdmin.from('production_log').select('*').gte('created_at', today).order('created_at', { ascending: false }).limit(5),
  ])

  const todayRev = (todaySales || []).reduce((s: number, r: any) => s + r.total, 0)
  const monthRev = (monthSales || []).reduce((s: number, r: any) => s + r.total, 0)
  const monthCost = 0 // simplified
  const lowStock = (stock || []).filter((m: any) => m.qty < m.min_qty).length

  const alertsList = (stock || [])
    .filter((m: any) => m.qty < m.min_qty)
    .slice(0, 4)
    .map((m: any) => ({
      type: m.qty === 0 ? 'error' : 'warn',
      msg: `${m.name}: ${m.qty} ${m.unit} (min: ${m.min_qty})`
    }))

  const recentLog = (prodLog || []).map((l: any) => ({ ...l, label: `${l.recipe_name} × 1 batch` }))

  return {
    props: {
      user,
      stats: { todayRev, monthRev, monthProfit: monthRev - monthCost, lowStock },
      alerts: alertsList,
      recentLog,
    }
  }
}
