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
  const [editItem, setEditItem] = useState<any>(null)
  const [editForm, setEditForm] = useState({ qty: '', min_qty: '', price_per_unit: '', packWeight: '', packPrice: '' })
  const [usePackCalc, setUsePackCalc] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', qty: '', unit: 'غرام', min_qty: '', packWeight: '', packPrice: '', price_per_unit: '' })
  const [addPackCalc, setAddPackCalc] = useState(true)
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const refresh = async () => {
    const res = await fetch('/api/stock')
    if (res.ok) setStock(await res.json())
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setEditForm({
      qty: String(item.qty ?? ''),
      min_qty: String(item.min_qty ?? ''),
      price_per_unit: String(item.price_per_unit ?? ''),
      packWeight: '',
      packPrice: ''
    })
    setUsePackCalc(false)
  }

  const saveEdit = async () => {
    if (!editItem) return
    let price = parseFloat(editForm.price_per_unit) || 0
    if (usePackCalc) {
      const w = parseFloat(editForm.packWeight)
      const p = parseFloat(editForm.packPrice)
      if (w > 0 && p > 0) price = p / w
    }
    setSaving(true)
    await fetch('/api/stock', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editItem.id,
        qty: parseFloat(editForm.qty) || 0,
        min_qty: parseFloat(editForm.min_qty) || 0,
        price_per_unit: price
      })
    })
    setStock(stock.map(s => s.id === editItem.id ? {
      ...s,
      qty: parseFloat(editForm.qty) || 0,
      min_qty: parseFloat(editForm.min_qty) || 0,
      price_per_unit: price
    } : s))
    setEditItem(null)
    setSaving(false)
  }

  const calcAddPrice = () => {
    const w = parseFloat(addForm.packWeight)
    const p = parseFloat(addForm.packPrice)
    if (w > 0 && p > 0) return (p / w).toFixed(6)
    return ''
  }

  const calcEditPrice = () => {
    const w = parseFloat(editForm.packWeight)
    const p = parseFloat(editForm.packPrice)
    if (w > 0 && p > 0) return (p / w).toFixed(6)
    return ''
  }

  const addMaterial = async () => {
    if (!addForm.name || !addForm.qty) return
    let price = parseFloat(addForm.price_per_unit) || 0
    if (addPackCalc) {
      const w = parseFloat(addForm.packWeight)
      const p = parseFloat(addForm.packPrice)
      if (w > 0 && p > 0) price = p / w
    }
    setSaving(true)
    await fetch('/api/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addForm.name, qty: parseFloat(addForm.qty), unit: addForm.unit, min_qty: parseFloat(addForm.min_qty) || 0, price_per_unit: price })
    })
    await refresh()
    setAddForm({ name: '', qty: '', unit: 'غرام', min_qty: '', packWeight: '', packPrice: '', price_per_unit: '' })
    setSaving(false)
  }

  const deleteMat = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف المادة؟' : 'Delete material?')) return
    await fetch('/api/stock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setStock(stock.filter(s => s.id !== id))
  }

  const getStatus = (item: any) => {
    if (item.qty <= 0) return { label: t.stock.empty, cls: 'tag-red' }
    if (item.min_qty > 0 && item.qty < item.min_qty) return { label: t.stock.low, cls: 'tag-yellow' }
    return { label: t.stock.ok, cls: 'tag-green' }
  }

  const totalValue = stock.reduce((s, m) => s + (m.qty || 0) * (m.price_per_unit || 0), 0)
  const lowCount = stock.filter(m => m.min_qty > 0 && m.qty < m.min_qty).length
  const emptyCount = stock.filter(m => m.qty <= 0).length
  const addPriceCalc = calcAddPrice()
  const editPriceCalc = calcEditPrice()

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'الأصناف' : 'Items'}</div><div className="metric-value">{stock.length}</div></div>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</div><div className="metric-value" style={{ fontSize: 16 }}>{totalValue.toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div></div>
          <div style={{ background: lowCount ? '#FAEEDA' : '#f5f5f3', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: lowCount ? '#854F0B' : '' }}>{t.stock.low}</div>
            <div className="metric-value" style={{ color: lowCount ? '#854F0B' : '' }}>{lowCount}</div>
          </div>
          <div style={{ background: emptyCount ? '#FCEBEB' : '#f5f5f3', borderRadius: 8, padding: '12px 14px' }}>
            <div className="metric-label" style={{ color: emptyCount ? '#A32D2D' : '' }}>{t.stock.empty}</div>
            <div className="metric-value" style={{ color: emptyCount ? '#A32D2D' : '' }}>{emptyCount}</div>
          </div>
        </div>

        {/* Edit Modal */}
        {editItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={e => e.target === e.currentTarget && setEditItem(null)}>
            <div className="card" style={{ width: 440, maxWidth: '100%' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{lang === 'ar' ? 'تعديل:' : 'Edit:'} {editItem.name}</div>
                <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}>×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>{lang === 'ar' ? `الكمية (${editItem.unit})` : `Qty (${editItem.unit})`}</div>
                  <input
                    type="number"
                    value={editForm.qty}
                    onChange={e => setEditForm({ ...editForm, qty: e.target.value })}
                    placeholder="0"
                    step="0.01"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>{lang === 'ar' ? `الحد الأدنى (${editItem.unit})` : `Min qty (${editItem.unit})`}</div>
                  <input
                    type="number"
                    value={editForm.min_qty}
                    onChange={e => setEditForm({ ...editForm, min_qty: e.target.value })}
                    placeholder="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 8 }}>{lang === 'ar' ? 'السعر' : 'Price'}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setUsePackCalc(false)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: !usePackCalc ? '#E1F5EE' : 'transparent', color: !usePackCalc ? '#085041' : '#888', borderColor: !usePackCalc ? '#1D9E75' : '#d4d4d4' }}>
                    {lang === 'ar' ? 'أدخل السعر مباشرة' : 'Direct price'}
                  </button>
                  <button onClick={() => setUsePackCalc(true)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: usePackCalc ? '#E1F5EE' : 'transparent', color: usePackCalc ? '#085041' : '#888', borderColor: usePackCalc ? '#1D9E75' : '#d4d4d4' }}>
                    {lang === 'ar' ? 'احسب من العبوة' : 'From pack'}
                  </button>
                </div>

                {!usePackCalc ? (
                  <div>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? `سعر الـ${editItem.unit} الواحد (ر.س)` : `Price per ${editItem.unit} (SAR)`}</div>
                    <input
                      type="number"
                      value={editForm.price_per_unit}
                      onChange={e => setEditForm({ ...editForm, price_per_unit: e.target.value })}
                      placeholder="0.000000"
                      step="0.000001"
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? `وزن العبوة (${editItem.unit})` : `Pack weight (${editItem.unit})`}</div>
                      <input type="number" value={editForm.packWeight} onChange={e => setEditForm({ ...editForm, packWeight: e.target.value })} placeholder="5000" step="0.01" />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'سعر العبوة (ر.س)' : 'Pack price (SAR)'}</div>
                      <input type="number" value={editForm.packPrice} onChange={e => setEditForm({ ...editForm, packPrice: e.target.value })} placeholder="305" step="0.01" />
                    </div>
                    {editPriceCalc && (
                      <div style={{ gridColumn: '1/-1', background: '#E1F5EE', padding: '8px 12px', borderRadius: 8, fontSize: 12, color: '#085041' }}>
                        = <strong>{parseFloat(editPriceCalc).toFixed(6)}</strong> {t.currency}/{editItem.unit}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }} onClick={saveEdit} disabled={saving}>
                  {saving ? '...' : (lang === 'ar' ? 'حفظ' : 'Save')}
                </button>
                <button className="btn" style={{ padding: '11px 16px' }} onClick={() => setEditItem(null)}>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stock table */}
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 70px 120px 90px 80px 80px', gap: 8, padding: '8px 16px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
              <span>{t.stock.material}</span>
              <span>{t.stock.qty}</span>
              <span>{t.stock.unit}</span>
              <span>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</span>
              <span>{lang === 'ar' ? 'القيمة' : 'Value'}</span>
              <span>{t.stock.status}</span>
              <span></span>
            </div>
            <div style={{ padding: '0 16px' }}>
              {stock.map(item => {
                const st = getStatus(item)
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 70px 120px 90px 80px 80px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{ fontWeight: 500, color: item.qty <= 0 ? '#A32D2D' : '#333' }}>{item.qty}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>{item.unit}</span>
                    <div>
                      <div style={{ fontSize: 12 }}>{(item.price_per_unit || 0).toFixed(4)} {t.currency}</div>
                      <div style={{ fontSize: 9, color: '#aaa' }}>{t.currency}/{item.unit}</div>
                    </div>
                    <span style={{ color: '#888', fontSize: 11 }}>{((item.qty || 0) * (item.price_per_unit || 0)).toFixed(1)} {t.currency}</span>
                    <span className={`tag ${st.cls}`} style={{ fontSize: 10 }}>{st.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 14, padding: 4 }}>✏️</button>
                      <button onClick={() => deleteMat(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: 4 }}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add material */}
          <div style={{ padding: '14px 16px', borderTop: '0.5px solid #e5e5e5', background: '#fafaf8' }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, color: '#555' }}>
              {lang === 'ar' ? '+ إضافة مادة جديدة' : '+ Add new material'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'اسم المادة' : 'Material'}</div>
                <input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: شوكلت' : 'e.g. Chocolate'} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'الكمية' : 'Qty'}</div>
                <input type="number" value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} placeholder="0" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'الوحدة' : 'Unit'}</div>
                <select value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })} style={{ padding: '8px 6px' }}>
                  <option value="غرام">غرام</option>
                  <option value="كجم">كجم</option>
                  <option value="لتر">لتر</option>
                  <option value="مل">مل</option>
                  <option value="حبة">حبة</option>
                  <option value="وحدة">وحدة</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'الحد الأدنى' : 'Min'}</div>
                <input type="number" value={addForm.min_qty} onChange={e => setAddForm({ ...addForm, min_qty: e.target.value })} placeholder="0" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setAddPackCalc(true)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: addPackCalc ? '#E1F5EE' : 'transparent', color: addPackCalc ? '#085041' : '#888', borderColor: addPackCalc ? '#1D9E75' : '#d4d4d4' }}>
                {lang === 'ar' ? 'احسب من العبوة' : 'From pack'}
              </button>
              <button onClick={() => setAddPackCalc(false)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: !addPackCalc ? '#E1F5EE' : 'transparent', color: !addPackCalc ? '#085041' : '#888', borderColor: !addPackCalc ? '#1D9E75' : '#d4d4d4' }}>
                {lang === 'ar' ? 'أدخل السعر مباشرة' : 'Direct price'}
              </button>
            </div>

            {addPackCalc ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 10, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'وزن العبوة (بنفس الوحدة)' : 'Pack weight'}</div>
                  <input type="number" value={addForm.packWeight} onChange={e => setAddForm({ ...addForm, packWeight: e.target.value })} placeholder="5000" step="0.01" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'سعر العبوة (ر.س)' : 'Pack price'}</div>
                  <input type="number" value={addForm.packPrice} onChange={e => setAddForm({ ...addForm, packPrice: e.target.value })} placeholder="305" step="0.01" />
                </div>
                {addPriceCalc && (
                  <div style={{ background: '#E1F5EE', padding: '8px 12px', borderRadius: 8, fontSize: 12, color: '#085041', whiteSpace: 'nowrap' }}>
                    = <strong>{parseFloat(addPriceCalc).toFixed(4)}</strong> {t.currency}/{addForm.unit}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 10, maxWidth: 200 }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? `سعر الـ${addForm.unit} الواحد` : `Price per ${addForm.unit}`}</div>
                <input type="number" value={addForm.price_per_unit} onChange={e => setAddForm({ ...addForm, price_per_unit: e.target.value })} placeholder="0.000000" step="0.000001" />
              </div>
            )}

            <button className="btn btn-primary" onClick={addMaterial} disabled={saving} style={{ padding: '8px 18px', fontSize: 13 }}>
              {saving ? '...' : (lang === 'ar' ? '+ إضافة' : '+ Add')}
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
  const bid = user.bakery_id
  const { data } = bid
    ? await supabaseAdmin.from('stock').select('*').eq('bakery_id', bid).order('name')
    : await supabaseAdmin.from('stock').select('*').order('name')
  return { props: { user, initialStock: data || [] } }
}
