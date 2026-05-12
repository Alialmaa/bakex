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
  const [form, setForm] = useState({ name: '', qty: '', unit: 'غرام', min_qty: '', packWeight: '', packPrice: '', price_per_unit: '' })
  const [usePackCalc, setUsePackCalc] = useState(true)
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const refresh = async () => {
    const res = await fetch('/api/stock')
    if (res.ok) setStock(await res.json())
  }

  const calcPricePerUnit = () => {
    const w = parseFloat(form.packWeight)
    const p = parseFloat(form.packPrice)
    if (w > 0 && p > 0) return (p / w).toFixed(6)
    return ''
  }

  const addMaterial = async () => {
    if (!form.name || !form.qty) return
    let pricePerUnit = parseFloat(form.price_per_unit) || 0
    if (usePackCalc) {
      const w = parseFloat(form.packWeight)
      const p = parseFloat(form.packPrice)
      if (w > 0 && p > 0) pricePerUnit = p / w
    }
    setSaving(true)
    await fetch('/api/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, qty: parseFloat(form.qty), unit: form.unit, min_qty: parseFloat(form.min_qty) || 0, price_per_unit: pricePerUnit })
    })
    await refresh()
    setForm({ name: '', qty: '', unit: 'غرام', min_qty: '', packWeight: '', packPrice: '', price_per_unit: '' })
    setSaving(false)
  }

  const updateField = async (id: string, field: string, value: number) => {
    await fetch('/api/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [field]: value }) })
    setStock(stock.map(s => s.id === id ? { ...s, [field]: value } : s))
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
    if (item.min_qty > 0 && item.qty < item.min_qty) return { label: t.stock.low, cls: 'tag-yellow' }
    return { label: t.stock.ok, cls: 'tag-green' }
  }

  const totalValue = stock.reduce((s, m) => s + m.qty * m.price_per_unit, 0)
  const lowCount = stock.filter(m => m.min_qty > 0 && m.qty < m.min_qty).length
  const emptyCount = stock.filter(m => m.qty <= 0).length
  const pricePerUnit = calcPricePerUnit()

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'الأصناف' : 'Items'}</div><div className="metric-value">{stock.length}</div></div>
          <div className="metric"><div className="metric-label">{lang === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</div><div className="metric-value" style={{fontSize:16}}>{totalValue.toFixed(0)} <span style={{fontSize:12,fontWeight:400}}>{t.currency}</span></div></div>
          <div style={{background:lowCount?'#FAEEDA':'#f5f5f3',borderRadius:8,padding:'12px 14px'}}>
            <div className="metric-label" style={{color:lowCount?'#854F0B':''}}>{t.stock.low}</div>
            <div className="metric-value" style={{color:lowCount?'#854F0B':''}}>{lowCount}</div>
          </div>
          <div style={{background:emptyCount?'#FCEBEB':'#f5f5f3',borderRadius:8,padding:'12px 14px'}}>
            <div className="metric-label" style={{color:emptyCount?'#A32D2D':''}}>{t.stock.empty}</div>
            <div className="metric-value" style={{color:emptyCount?'#A32D2D':''}}>{emptyCount}</div>
          </div>
        </div>

        <div className="card" style={{padding:0,overflowX:'auto'}}>
          <div style={{minWidth:700}}>
            <div style={{display:'grid',gridTemplateColumns:'1.8fr 110px 70px 80px 130px 90px 80px',gap:8,padding:'8px 16px',borderBottom:'0.5px solid #d4d4d4',fontSize:11,color:'#888',fontWeight:500}}>
              <span>{t.stock.material}</span><span>{t.stock.qty}</span><span>{t.stock.unit}</span>
              <span>{lang==='ar'?'الحد الأدنى':'Min'}</span>
              <span>{lang==='ar'?'سعر الوحدة':'Unit Price'}</span>
              <span>{lang==='ar'?'القيمة':'Value'}</span><span>{t.stock.status}</span>
            </div>
            <div style={{padding:'0 16px'}}>
              {stock.map(item => {
                const st = getStatus(item)
                return (
                  <div key={item.id} style={{display:'grid',gridTemplateColumns:'1.8fr 110px 70px 80px 130px 90px 80px',gap:8,alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid #e5e5e5',fontSize:13}}>
                    <span style={{fontWeight:500}}>{item.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <button onClick={()=>updateQty(item.id,Math.max(0,item.qty-1))} style={{width:22,height:22,borderRadius:5,border:'0.5px solid #d4d4d4',background:'#f5f5f3',cursor:'pointer',fontSize:14}}>−</button>
                      <span style={{minWidth:32,textAlign:'center',fontWeight:500,fontSize:12}}>{item.qty}</span>
                      <button onClick={()=>updateQty(item.id,item.qty+1)} style={{width:22,height:22,borderRadius:5,border:'0.5px solid #d4d4d4',background:'#f5f5f3',cursor:'pointer',fontSize:14}}>+</button>
                    </div>
                    <span style={{color:'#888',fontSize:12}}>{item.unit}</span>
                    <input type="number" defaultValue={item.min_qty??0} key={`min-${item.id}`} style={{width:65,padding:'4px 6px'}} onBlur={e=>updateField(item.id,'min_qty',parseFloat(e.target.value)||0)} />
                    <div>
                      <input type="number" defaultValue={item.price_per_unit??0} key={`price-${item.id}`} style={{width:90,padding:'4px 6px'}} step="0.000001" onBlur={e=>updateField(item.id,'price_per_unit',parseFloat(e.target.value)||0)} />
                      <div style={{fontSize:9,color:'#aaa',marginTop:2}}>{t.currency}/{item.unit}</div>
                    </div>
                    <span style={{color:'#888',fontSize:11}}>{(item.qty*item.price_per_unit).toFixed(1)} {t.currency}</span>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span className={`tag ${st.cls}`} style={{fontSize:10}}>{st.label}</span>
                      <button onClick={()=>deleteMat(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',padding:2,fontSize:13}}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{padding:'14px 16px',borderTop:'0.5px solid #e5e5e5',background:'#fafaf8'}}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:10,color:'#555'}}>{lang==='ar'?'+ إضافة مادة جديدة':'+ Add new material'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 80px',gap:8,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'اسم المادة':'Material'}</div>
                <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={lang==='ar'?'مثال: شوكلت':'e.g. Chocolate'} />
              </div>
              <div>
                <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'الكمية':'Qty'}</div>
                <input type="number" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} placeholder="0" />
              </div>
              <div>
                <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'الوحدة':'Unit'}</div>
                <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={{padding:'8px 6px'}}>
                  <option value="غرام">غرام</option>
                  <option value="كجم">كجم</option>
                  <option value="لتر">لتر</option>
                  <option value="مل">مل</option>
                  <option value="حبة">حبة</option>
                  <option value="وحدة">وحدة</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'الحد الأدنى':'Min'}</div>
                <input type="number" value={form.min_qty} onChange={e=>setForm({...form,min_qty:e.target.value})} placeholder="0" />
              </div>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button onClick={()=>setUsePackCalc(true)} style={{padding:'5px 12px',fontSize:12,borderRadius:6,border:'0.5px solid',cursor:'pointer',fontFamily:'inherit',background:usePackCalc?'#E1F5EE':'transparent',color:usePackCalc?'#085041':'#888',borderColor:usePackCalc?'#1D9E75':'#d4d4d4'}}>
                {lang==='ar'?'📦 احسب من العبوة':'📦 From pack'}
              </button>
              <button onClick={()=>setUsePackCalc(false)} style={{padding:'5px 12px',fontSize:12,borderRadius:6,border:'0.5px solid',cursor:'pointer',fontFamily:'inherit',background:!usePackCalc?'#E1F5EE':'transparent',color:!usePackCalc?'#085041':'#888',borderColor:!usePackCalc?'#1D9E75':'#d4d4d4'}}>
                {lang==='ar'?'✏️ أدخل السعر مباشرة':'✏️ Direct price'}
              </button>
            </div>

            {usePackCalc ? (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginBottom:10,alignItems:'end'}}>
                <div>
                  <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'وزن/كمية العبوة (بنفس الوحدة)':'Pack weight (same unit)'}</div>
                  <input type="number" value={form.packWeight} onChange={e=>setForm({...form,packWeight:e.target.value})} placeholder={lang==='ar'?'مثال: 5000':'e.g. 5000'} step="0.01" />
                </div>
                <div>
                  <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?'سعر العبوة (ر.س)':'Pack price (SAR)'}</div>
                  <input type="number" value={form.packPrice} onChange={e=>setForm({...form,packPrice:e.target.value})} placeholder={lang==='ar'?'مثال: 305':'e.g. 305'} step="0.01" />
                </div>
                {pricePerUnit && (
                  <div style={{background:'#E1F5EE',padding:'8px 12px',borderRadius:8,fontSize:12,color:'#085041',whiteSpace:'nowrap'}}>
                    = <strong>{parseFloat(pricePerUnit).toFixed(4)}</strong> {t.currency}/{form.unit}
                  </div>
                )}
              </div>
            ) : (
              <div style={{marginBottom:10,maxWidth:200}}>
                <div style={{fontSize:10,color:'#888',marginBottom:3}}>{lang==='ar'?`سعر الوحدة (ر.س/${form.unit})`:`Unit price (SAR/${form.unit})`}</div>
                <input type="number" value={form.price_per_unit} onChange={e=>setForm({...form,price_per_unit:e.target.value})} placeholder="0.000000" step="0.000001" />
              </div>
            )}

            <button className="btn btn-primary" onClick={addMaterial} disabled={saving} style={{padding:'8px 18px',fontSize:13}}>
              {saving?'...':(lang==='ar'?'+ إضافة':'+ Add')}
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