import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons, TrashIcon } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { fmtDateLong, fromDayString } from '../lib/datetime'

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <MetricCard
            label={lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}
            value={purchases.length}
            sub={lang === 'ar' ? 'عملية شراء مسجّلة' : 'recorded purchases'}
            icon={Icons.truck} tone="blue"
          />
          <MetricCard
            label={lang === 'ar' ? 'إجمالي المصروف' : 'Total Spent'}
            value={totalSpent.toFixed(0)} unit={t.currency}
            sub={lang === 'ar' ? 'مصروف على المواد الخام' : 'spent on raw materials'}
            icon={Icons.wallet} tone="red"
          />
          <MetricCard
            label={lang === 'ar' ? 'أصناف مشتراة' : 'Items purchased'}
            value={new Set(purchases.map(p => p.material_name)).size}
            sub={lang === 'ar' ? 'مادة مختلفة' : 'distinct materials'}
            icon={Icons.layers} tone="violet"
          />
        </div>

        {/* Add purchase form */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>
            {lang === 'ar' ? '+ تسجيل شراء جديد' : '+ Record new purchase'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 90px', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'المادة' : 'Material'}</div>
              <select value={form.material_name} onChange={e => {
                const stk = stock.find(s => s.name === e.target.value)
                setForm({ ...form, material_name: e.target.value, unit: stk?.unit || 'غرام' })
              }} style={{ padding: '9px 10px', borderRadius: 8, border: '0.5px solid #d4d4d4', fontSize: 13, background: '#fff', width: '100%' }}>
                <option value="">{lang === 'ar' ? '-- اختر المادة --' : '-- Select material --'}</option>
                {stock.map(s => <option key={s.id} value={s.name}>{s.name} ({lang === 'ar' ? 'المخزون الحالي:' : 'Stock:'} {s.qty} {s.unit})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'الكمية المشتراة' : 'Qty bought'}</div>
              <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0" step="0.01" />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'الوحدة' : 'Unit'}</div>
              <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>

          {/* Price method */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            {([
              { on: usePackCalc,  set: true,  icon: Icons.box,    label: lang === 'ar' ? 'سعر العبوة' : 'Pack price' },
              { on: !usePackCalc, set: false, icon: Icons.tag,    label: lang === 'ar' ? 'سعر الوحدة مباشرة' : 'Direct unit price' },
            ]).map(({ on, set, icon, label }) => (
              <button key={label} onClick={() => setUsePackCalc(set)} style={{
                padding: '6px 13px', fontSize: 12, borderRadius: 7, border: '1px solid', cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                background: on ? '#ecfdf5' : '#fff', color: on ? '#065f46' : '#6b7280',
                borderColor: on ? '#16a679' : '#e5e7eb', fontWeight: on ? 600 : 500,
              }}>
                <span className="ico-sm" style={{ opacity: on ? 1 : 0.55 }}>{icon}</span>{label}
              </button>
            ))}
          </div>

          {usePackCalc ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? `وزن العبوة (${form.unit})` : `Pack weight (${form.unit})`}</div>
                <input type="number" value={form.pack_weight} onChange={e => setForm({ ...form, pack_weight: e.target.value })} placeholder="5000" step="0.01" />
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'سعر العبوة (ر.س)' : 'Pack price (SAR)'}</div>
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
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? `سعر الـ${form.unit} (ر.س)` : `Price per ${form.unit}`}</div>
              <input type="number" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} placeholder="0.000001" step="0.000001" />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</div>
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={lang === 'ar' ? 'مثال: من محل الجملة' : 'e.g. Bought from wholesale'} />
          </div>

          <div className="alert alert-info" style={{ marginBottom: 14 }}>
            <span className="ico-sm" style={{ flexShrink: 0, marginTop: 1 }}>{Icons.info}</span>
            {lang === 'ar' ? 'عند الحفظ: سيزيد المخزون تلقائياً وسيتحدث سعر الوحدة' : 'On save: Stock will increase and unit price will update automatically'}
          </div>

          <button className="btn btn-primary" onClick={addPurchase} disabled={saving || !form.material_name || !form.qty} style={{ padding: '10px 20px', fontSize: 13 }}>
            {saving ? '...' : (lang === 'ar' ? 'تسجيل الشراء' : 'Record Purchase')}
          </button>
        </div>

        {/* Purchase history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card-title">{lang === 'ar' ? 'سجل المشتريات' : 'Purchase History'}</div>
          {purchases.length === 0 ? (
            <div className="tbl"><div className="tbl-empty">{lang === 'ar' ? 'لا توجد مشتريات بعد' : 'No purchases yet'}</div></div>
          ) : Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]: any) => (
            <div key={date} className="tbl">
              <div style={{ padding: '11px 16px', background: '#fcfcfd', borderBottom: '1px solid #e5e7eb', fontSize: 12.5, fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ico-sm" style={{ color: '#9ca3af' }}>{Icons.calendar}</span>
                <span suppressHydrationWarning>{fmtDateLong(fromDayString(date), lang)}</span>
              </div>
              {items.map((p: any) => (
                <div key={p.id} className="trow" style={{ gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{p.material_name}</div>
                    <div style={{ fontSize: 11.5, color: '#9ca3af', display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                      <span className="num">{p.qty} {p.unit}</span>
                      {p.pack_price && <span className="num">{lang === 'ar' ? 'سعر العبوة:' : 'Pack price:'} {p.pack_price} {t.currency}</span>}
                      <span className="num">{lang === 'ar' ? 'سعر الوحدة:' : 'Unit price:'} {(p.price_per_unit || 0).toFixed(4)} {t.currency}/{p.unit}</span>
                      {p.notes && <span>• {p.notes}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.pack_price && <span className="num" style={{ fontWeight: 600, color: '#dc2626' }}>{p.pack_price} {t.currency}</span>}
                    <button className="ibtn ibtn-del" title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => deletePurchase(p.id)}><TrashIcon /></button>
                  </div>
                </div>
              ))}
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
  if (!user.perms?.stock) return { redirect: { destination: '/403', permanent: false } }

  const bid = user.bakery_id
  const [{ data: purchases }, { data: stock }] = await Promise.all([
    bid ? supabaseAdmin.from('purchases').select('*').eq('bakery_id', bid).order('created_at', { ascending: false }).limit(100) : supabaseAdmin.from('purchases').select('*').order('created_at', { ascending: false }).limit(100),
    bid ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bid).order('name') : supabaseAdmin.from('stock').select('*').order('name'),
  ])

  return { props: { user, initialPurchases: purchases || [], initialStock: stock || [] } }
}
