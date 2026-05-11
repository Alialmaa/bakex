import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T, Lang } from '../lib/translations'

export default function SalesPage({ user, initialRecipes, initialSales }: any) {
  const [lang, setLang] = useState<Lang>('ar')
  const [recipes] = useState<any[]>(initialRecipes || [])
  const [sales, setSales] = useState<any[]>(initialSales || [])
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries((initialRecipes || []).map((r: any) => [r.id, r.sell_price || 0]))
  )
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const recordSales = async () => {
    const entries = recipes
      .filter(r => (qtys[r.id] || 0) > 0)
      .map(r => ({
        recipe_id: r.id,
        recipe_name: r.name,
        qty: qtys[r.id],
        unit_price: prices[r.id] || 0,
        total: (qtys[r.id] || 0) * (prices[r.id] || 0),
      }))
    if (entries.length === 0) return
    setSaving(true)
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    if (res.ok) {
      const newSales = await res.json()
      setSales([...newSales, ...sales])
      setQtys({})
    }
    setSaving(false)
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const totalToday = sales
    .filter(s => s.created_at?.startsWith(todayStr))
    .reduce((sum: number, s: any) => sum + s.total, 0)

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <div className="metric">
            <div className="metric-label">{lang === 'ar' ? 'مبيعات اليوم' : "Today's Sales"}</div>
            <div className="metric-value">{totalToday.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div>
          </div>
          <div className="metric">
            <div className="metric-label">{lang === 'ar' ? 'عدد الفواتير' : 'Transactions'}</div>
            <div className="metric-value">{sales.length}</div>
          </div>
          <div className="metric">
            <div className="metric-label">{lang === 'ar' ? 'المنتجات' : 'Products'}</div>
            <div className="metric-value">{recipes.length}</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{t.sales.recordToday}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px', gap: 8, padding: '4px 0 8px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <span>{lang === 'ar' ? 'المنتج' : 'Product'}</span>
            <span>{lang === 'ar' ? 'كوست الحبة' : 'Unit Cost'}</span>
            <span>{lang === 'ar' ? 'سعر البيع' : 'Sell Price'}</span>
            <span>{lang === 'ar' ? 'الكمية' : 'Qty Sold'}</span>
          </div>
          {recipes.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px', gap: 8, padding: '10px 0', borderBottom: '0.5px solid #e5e5e5', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{(r.unit_cost || 0).toFixed(2)} {t.currency}</span>
              <input
                type="number"
                value={prices[r.id] || 0}
                min={0}
                step={0.5}
                onChange={e => setPrices({ ...prices, [r.id]: parseFloat(e.target.value) || 0 })}
                style={{ width: 90, padding: '5px 8px' }}
              />
              <input
                type="number"
                value={qtys[r.id] || 0}
                min={0}
                onChange={e => setQtys({ ...qtys, [r.id]: parseInt(e.target.value) || 0 })}
                style={{ width: 70, padding: '5px 8px' }}
              />
            </div>
          ))}
          <button
            onClick={recordSales}
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '11px 0' }}
          >
            {saving ? '...' : t.sales.confirm}
          </button>
        </div>

        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>{t.sales.log}</div>
          {sales.length === 0
            ? <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>{t.sales.noSales}</div>
            : sales.slice(0, 15).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                <span>{s.recipe_name} × {s.qty}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 500 }}>{s.total?.toFixed(2)} {t.currency}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{new Date(s.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))
          }
        </div>

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.sales) return { redirect: { destination: '/', permanent: false } }

  const [{ data: recipes }, { data: sales }] = await Promise.all([
    supabaseAdmin.from('recipes').select('*').order('name'),
    supabaseAdmin.from('sales').select('*').order('created_at', { ascending: false }).limit(50),
  ])

  return { props: { user, initialRecipes: recipes || [], initialSales: sales || [] } }
}
