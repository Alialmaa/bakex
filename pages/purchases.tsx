import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function PurchasesPage({ user, initialPurchases, initialStock }: any) {
  const { lang, setLang } = useLang()
  const [purchases, setPurchases] = useState<any[]>(initialPurchases || [])
  const [stock] = useState<any[]>(initialStock || [])
  const [saving, setSaving] = useState(false)
  const [usePackCalc, setUsePackCalc] = useState(true)
  const [form, setForm] = useState({
    material_name: '', qty: '', unit: 'غرام',
    pack_weight: '', pack_price: '', price_per_unit: '', notes: ''
  })
  const t = T[lang]

  const calcPrice = () => {
    const w = parseFloat(form.pack_weight)
    const p = parseFloat(form.pack_price)
    if (w > 0 && p > 0) return p / w
    return null
  }

  const addPurchase = async () => {
    if (!form.material_name || !form.qty) return
    let price = parseFloat(form.price_per_unit) || 0
    let packPrice = parseFloat(form.pack_price) || 0
    let packWeight = parseFloat(form.pack_weight) || 0
    if (usePackCalc && packWeight > 0 && packPrice > 0) {
      price = packPrice / packWeight
    }

    setSaving(true)
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material_name: form.material_name,
        qty: parseFloat(form.qty),
        unit: form.unit,
        pack_weight: packWeight || null,
        pack_price: packPrice || null,
        price_per_unit: price,
        notes: form.notes
      })
    })
    if (res.ok) {
      const data = await res.json()
      setPurchases([data, ...purchases])
      setForm({ material_name: '', qty: '', unit: 'غرام', pack_weight: '', pack_price: '', price_per_unit: '', notes: '' })
    }
    setSaving(false)
  }

  const deletePurchase = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف هذا الشراء؟' : 'Delete this purchase?')) return
    await fetch('/api/purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPurchases(purchases.filter(p => p.id !== id))
  }

  const priceCalc = calcPrice()
  const totalSpent = purchases.reduce((s, p) => s + (p.pack_price || (p.qty * p.price_per_unit) || 0), 0)

  // Group by date
  const grouped = purchases.reduce((acc: any, p: any) => {
    const date = p.created_at?.split('T')[0] || 'unknown'
    if (!acc[date]) acc[date] = []
    acc[date].push(p)
    return acc
  }, {})

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}</div><div className="metric-value">{purchases.length}</div></div>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'إجمالي المصروف' : 'Total Spent'}</div><div className="metric-value" style={{ fontSize: 16 }}>{totalSpent.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div></div>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'أصناف مشتراة' : 'Items purchased'}</div><div className="metric-value">{new Set(purchases.map(p => p.material_name)).size}</div></div>
        </div>

        {/* Add purchase form */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            {lang === 'ar' ? '+ تسجيل شراء جديد' : '+ Record new purchase'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 90px', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'المادة' : 'Material'}</div>
              <select value={form.material_name} onChange={e => {
                const stk = stock.find(s => s.name === e.target.value)
                setForm({ ...form, material_name: e.target.value, unit: stk?.unit || 'غرام' })
              }} style={{ padding: '9px 10px', borderRadius: 8, border: '0.5px solid #d4d4d4', fontSize: 13, background: '#fff', width: '100%' }}>
                <option value="">{lang === 'ar' ? '-- اختر المادة --' : '-- Select material --'}</option>
                {stock.map(s => <option key={s.id} value={s.name}>{s.name} ({lang === 'ar' ? 'المخزون الحالي:' : 'Stock:'} {s.qty} {s.unit})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'الكمية المشتراة' : 'Qty bought'}</div>
              <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0" step="0.01" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'الوحدة' : 'Unit'}</div>
              <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>

          {/* Price method */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setUsePackCalc(true)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: usePackCalc ? '#E1F5EE' : 'transparent', color: usePackCalc ? '#085041' : '#888', borderColor: usePackCalc ? '#1D9E75' : '#d4d4d4' }}>
              {lang === 'ar' ? '📦 سعر العبوة' : '📦 Pack price'}
            </button>
            <button onClick={() => setUsePackCalc(false)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: !usePackCalc ? '#E1F5EE' : 'transparent', color: !usePackCalc ? '#085041' : '#888', borderColor: !usePackCalc ? '#1D9E75' : '#d4d4d4' }}>
              {lang === 'ar' ? 'سعر الوحدة مباشرة' : 'Direct unit price'}
            </button>
          </div>

          {usePackCalc ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? `وزن العبوة (${form.unit})` : `Pack weight (${form.unit})`}</div>
                <input type="number" value={form.pack_weight} onChange={e => setForm({ ...form, pack_weight: e.target.value })} placeholder="5000" step="0.01" />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'سعر العبوة (ر.س)' : 'Pack price (SAR)'}</div>
                <input type="number" value={form.pack_price} onChange={e => setForm({ ...form, pack_price: e.target.value })} placeholder="305" step="0.01" />
              </div>
              {priceCalc && (
                <div style={{ background: '#E1F5EE', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: '#085041', whiteSpace: 'nowrap' }}>
                  = <strong>{priceCalc.toFixed(6)}</strong><br />{t.currency}/{form.unit}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 12, maxWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? `سعر الـ${form.unit} (ر.س)` : `Price per ${form.unit}`}</div>
              <input type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} placeholder="0.000001" step="0.000001" />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</div>
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={lang === 'ar' ? 'مثال: من محل الجملة' : 'e.g. Bought from wholesale'} />
          </div>

          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            ℹ {lang === 'ar' ? 'عند الحفظ: سيزيد المخزون تلقائياً وسيتحدث سعر الوحدة' : 'On save: Stock will increase and unit price will update automatically'}
          </div>

          <button className="btn btn-primary" onClick={addPurchase} disabled={saving || !form.material_name || !form.qty} style={{ padding: '10px 20px', fontSize: 13 }}>
            {saving ? '...' : (lang === 'ar' ? '✓ تسجيل الشراء' : '✓ Record Purchase')}
          </button>
        </div>

        {/* Purchase history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{lang === 'ar' ? 'سجل المشتريات' : 'Purchase History'}</div>
          {purchases.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: '24px 0' }}>
              {lang === 'ar' ? 'لا توجد مشتريات بعد' : 'No purchases yet'}
            </div>
          ) : Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]: any) => (
            <div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#f5f5f3', borderBottom: '0.5px solid #e5e5e5', fontSize: 12, fontWeight: 500, color: '#555' }}>
                📅 {new Date(date + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ padding: '0 16px' }}>
                {items.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.material_name}</div>
                      <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 10, marginTop: 2 }}>
                        <span>{p.qty} {p.unit}</span>
                        {p.pack_price && <span>سعر العبوة: {p.pack_price} {t.currency}</span>}
                        <span>{lang === 'ar' ? 'سعر الوحدة:' : 'Unit price:'} {(p.price_per_unit || 0).toFixed(4)} {t.currency}/{p.unit}</span>
                        {p.notes && <span style={{ color: '#aaa' }}>• {p.notes}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.pack_price && <span style={{ fontWeight: 500, color: '#E24B4A' }}>{p.pack_price} {t.currency}</span>}
                      <button onClick={() => deletePurchase(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: 4 }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.stock) return { redirect: { destination: '/', permanent: false } }

  const bid = user.bakery_id
  const [{ data: purchases }, { data: stock }] = await Promise.all([
    bid ? supabaseAdmin.from('purchases').select('*').eq('bakery_id', bid).order('created_at', { ascending: false }).limit(100) : supabaseAdmin.from('purchases').select('*').order('created_at', { ascending: false }).limit(100),
    bid ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bid).order('name') : supabaseAdmin.from('stock').select('*').order('name'),
  ])

  return { props: { user, initialPurchases: purchases || [], initialStock: stock || [] } }
}
