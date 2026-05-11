import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function StockPage({ user, initialStock }: any) {
  const { lang, setLang } = useLang()
  const [stock, setStock] = useState<any[]>(initialStock || [])
  const [form, setForm] = useState({ name: '', qty: '', unit: 'كجم', min_qty: '', price_per_unit: '' })
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const refresh = async () => {
    const res = await fetch('/api/stock')
    if (res.ok) setStock(await res.json())
  }

  const addMaterial = async () => {
    if (!form.name || !form.qty) return
    setSaving(true)
    await fetch('/api/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, qty: parseFloat(form.qty), min_qty: parseFloat(form.min_qty) || 0, price_per_unit: parseFloat(form.price_per_unit) || 0 })
    })
    await refresh()
    setForm({ name: '', qty: '', unit: 'كجم', min_qty: '', price_per_unit: '' })
    setSaving(false)
  }

  const updateQty = async (id: string, qty: number) => {
    await fetch('/api/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, qty }) })
    setStock(stock.map(s => s.id === id ? { ...s, qty } : s))
  }

  const deleteMat = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف المادة؟' : 'Delete material?')) return
    await fetch('/api/stock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await refresh()
  }

  const getStatus = (item: any) => {
    if (item.qty <= 0) return { label: t.stock.empty, cls: 'tag-red' }
    if (item.qty < item.min_qty) return { label: t.stock.low, cls: 'tag-yellow' }
    return { label: t.stock.ok, cls: 'tag-green' }
  }

  const totalValue = stock.reduce((s, m) => s + m.qty * m.price_per_unit, 0)
  const lowCount = stock.filter(m => m.qty < m.min_qty).length
  const emptyCount = stock.filter(m => m.qty <= 0).length

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'الأصناف' : 'Items'}</div><div className="metric-value">{stock.length}</div></div>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</div><div className="metric-value">{totalValue.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div></div>
          <div style={{ background: lowCount ? '#FAEEDA' : '#f5f5f3', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: lowCount ? '#854F0B' : '' }}>{t.stock.low}</div>
            <div className="metric-value" style={{ color: lowCount ? '#854F0B' : '' }}>{lowCount}</div>
          </div>
          <div style={{ background: emptyCount ? '#FCEBEB' : '#f5f5f3', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: emptyCount ? '#A32D2D' : '' }}>{t.stock.empty}</div>
            <div className="metric-value" style={{ color: emptyCount ? '#A32D2D' : '' }}>{emptyCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 100px 70px 90px 90px 80px 80px', gap: 8, padding: '8px 16px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <span>{t.stock.material}</span><span>{t.stock.qty}</span><span>{t.stock.unit}</span><span>{t.stock.min}</span><span>{t.stock.price}</span><span>{lang === 'ar' ? 'القيمة' : 'Value'}</span><span>{t.stock.status}</span>
          </div>
          <div style={{ padding: '0 16px' }}>
            {stock.map(item => {
              const st = getStatus(item)
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 100px 70px 90px 90px 80px 80px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button onClick={() => updateQty(item.id, Math.max(0, item.qty - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#f5f5f3', cursor: 'pointer', fontSize: 15 }}>−</button>
                    <span style={{ minWidth: 30, textAlign: 'center', fontWeight: 500 }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#f5f5f3', cursor: 'pointer', fontSize: 15 }}>+</button>
                  </div>
                  <span style={{ color: '#888' }}>{item.unit}</span>
                  <input type="number" defaultValue={item.min_qty} style={{ width: 70, padding: '4px 6px' }} onBlur={e => fetch('/api/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, min_qty: parseFloat(e.target.value) || 0 }) })} />
                  <input type="number" defaultValue={item.price_per_unit} style={{ width: 70, padding: '4px 6px' }} onBlur={e => fetch('/api/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, price_per_unit: parseFloat(e.target.value) || 0 }) })} />
                  <span style={{ color: '#888', fontSize: 12 }}>{(item.qty * item.price_per_unit).toFixed(0)} {t.currency}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`tag ${st.cls}`}>{st.label}</span>
                    <button onClick={() => deleteMat(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', padding: 2, fontSize: 14 }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '0.5px solid #e5e5e5', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'اسم المادة' : 'Material name'} style={{ width: 130 }} />
            <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder={lang === 'ar' ? 'كمية' : 'Qty'} style={{ width: 70 }} />
            <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder={lang === 'ar' ? 'وحدة' : 'Unit'} style={{ width: 60 }} />
            <input type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} placeholder={lang === 'ar' ? 'سعر' : 'Price'} style={{ width: 70 }} />
            <button className="btn btn-primary" onClick={addMaterial} disabled={saving} style={{ padding: '7px 14px', fontSize: 12 }}>
              {lang === 'ar' ? '+ إضافة' : '+ Add'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.stock) return { redirect: { destination: '/', permanent: false } }
  const { data } = await supabaseAdmin.from('stock').select('*').order('name')
  return { props: { user, initialStock: data || [] } }
}
