import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function ProducePage({ user, initialRecipes, initialStock, initialLog, initialMonthDates }: any) {
  const { lang, setLang } = useLang()
  const [recipes] = useState<any[]>(initialRecipes || [])
  const [stock, setStock] = useState<any[]>(initialStock || [])
  const [log, setLog] = useState<any[]>(initialLog || [])
  const [loading, setLoading] = useState<string | null>(null)
  const [batches, setBatches] = useState<Record<string, number>>({})
  const [editLog, setEditLog] = useState<any>(null)
  const [editQty, setEditQty] = useState('')
  const [tab, setTab] = useState<'produce' | 'log'>('produce')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [filteredLog, setFilteredLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const t = T[lang]

  // Build calendar for current month
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const todayStr = today.toISOString().split('T')[0]

  // Dates that have production
  const activeDates = new Set((initialMonthDates || []).map((l: any) => l.created_at?.split('T')[0]))
  log.forEach(l => activeDates.add(l.created_at?.split('T')[0]))

  useEffect(() => {
    loadDayLog(selectedDate)
  }, [selectedDate])

  const loadDayLog = async (date: string) => {
    setLoadingLog(true)
    const res = await fetch(`/api/production?date=${date}`)
    if (res.ok) setFilteredLog(await res.json())
    setLoadingLog(false)
  }

  const getStk = (name: string) => stock.find(s => s.name === name)

  const canMake = (recipe: any, b: number) =>
    recipe.ingredients?.every((ing: any) => {
      const m = getStk(ing.material)
      return m && m.qty >= ing.amount * b
    })

  const unitCost = (recipe: any) => {
    const total = recipe.ingredients?.reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0) || 0
    const units = recipe.units_per_batch || recipe.output_qty || 1
    return units > 0 ? total / units : 0
  }

  // Calculate max batches possible from current stock
  const maxBatches = (recipe: any) => {
    if (!recipe.ingredients?.length) return 0
    let max = Infinity
    for (const ing of recipe.ingredients) {
      const m = getStk(ing.material)
      if (!m || ing.amount <= 0) return 0
      max = Math.min(max, Math.floor(m.qty / ing.amount))
    }
    return max === Infinity ? 0 : max
  }

  const limitingIngredient = (recipe: any) => {
    if (!recipe.ingredients?.length) return null
    let min = Infinity
    let limiting = null
    for (const ing of recipe.ingredients) {
      const m = getStk(ing.material)
      if (!m || ing.amount <= 0) return ing.material
      const possible = Math.floor(m.qty / ing.amount)
      if (possible < min) { min = possible; limiting = ing.material }
    }
    return limiting
  }

  const produce = async (recipe: any) => {
    const b = batches[recipe.id] || 1
    if (!canMake(recipe, b)) return
    setLoading(recipe.id)
    const res = await fetch('/api/recipes/produce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipe.id, batches: b })
    })
    if (res.ok) {
      const updated = [...stock]
      recipe.ingredients?.forEach((ing: any) => {
        const m = updated.find(s => s.name === ing.material)
        if (m) m.qty = Math.max(0, m.qty - ing.amount * b)
      })
      setStock(updated)
      setBatches({ ...batches, [recipe.id]: 1 })
      await loadDayLog(selectedDate)
      setTab('log')
    } else {
      const err = await res.json()
      alert(err.error || 'Error')
    }
    setLoading(null)
  }

  const deleteLog = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف هذا الإدخال؟' : 'Delete this entry?')) return
    await fetch('/api/production', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setFilteredLog(filteredLog.filter(l => l.id !== id))
  }

  const saveEditLog = async () => {
    if (!editLog) return
    await fetch('/api/production', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editLog.id, output_qty: parseFloat(editQty) || 0 })
    })
    setFilteredLog(filteredLog.map(l => l.id === editLog.id ? { ...l, output_qty: parseFloat(editQty) || 0 } : l))
    setEditLog(null)
  }

  const monthNames = {
    ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December']
  }
  const dayNames = {
    ar: ['أح','إث','ثل','أر','خم','جم','سب'],
    en: ['Su','Mo','Tu','We','Th','Fr','Sa']
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Edit modal */}
        {editLog && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div className="card" style={{ width: 360 }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{lang === 'ar' ? 'تعديل إنتاج' : 'Edit production'}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{editLog.recipe_name}</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 5 }}>{lang === 'ar' ? `الكمية (${editLog.output_unit})` : `Qty (${editLog.output_unit})`}</div>
                <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} style={{ fontSize: 16 }} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }} onClick={saveEditLog}>
                  {lang === 'ar' ? 'حفظ' : 'Save'}
                </button>
                <button className="btn" style={{ padding: '10px 16px' }} onClick={() => setEditLog(null)}>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setTab('produce')} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: tab === 'produce' ? '#1D9E75' : '#fff', color: tab === 'produce' ? '#fff' : '#888', borderColor: tab === 'produce' ? '#1D9E75' : '#d4d4d4', fontWeight: tab === 'produce' ? 500 : 400 }}>
            🍞 {lang === 'ar' ? 'إنتاج' : 'Produce'}
          </button>
          <button onClick={() => setTab('log')} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: tab === 'log' ? '#1D9E75' : '#fff', color: tab === 'log' ? '#fff' : '#888', borderColor: tab === 'log' ? '#1D9E75' : '#d4d4d4', fontWeight: tab === 'log' ? 500 : 400 }}>
            📋 {lang === 'ar' ? 'السجل' : 'Log'}
          </button>
        </div>

        {tab === 'produce' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {recipes.map(r => {
              const b = batches[r.id] || 1
              const ok = canMake(r, b)
              const uc = unitCost(r)
              const units = r.units_per_batch || r.output_qty || 1
              return (
                <div key={r.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {r.batch_unit || 'صينية'} ← {units} {r.output_unit}
                      </div>
                    </div>
                    <span className="tag tag-gray" style={{ fontSize: 11, marginRight: 'auto', marginLeft: 'auto' }}>{uc.toFixed(3)} {t.currency}/{r.output_unit}</span>
                  </div>

                  {/* Max batches indicator */}
                  {(() => {
                    const max = maxBatches(r)
                    const lim = limitingIngredient(r)
                    const maxUnits = max * units
                    const color = max === 0 ? '#A32D2D' : max < 3 ? '#854F0B' : '#3B6D11'
                    const bg = max === 0 ? '#FCEBEB' : max < 3 ? '#FAEEDA' : '#E1F5EE'
                    return (
                      <div style={{ background: bg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, color, fontWeight: 500 }}>
                            {max === 0
                              ? (lang === 'ar' ? '⚠ المخزون لا يكفي' : '⚠ Insufficient stock')
                              : (lang === 'ar' ? `✓ تقدر تنتج ${max} ${r.batch_unit || 'صينية'}` : `✓ Can produce ${max} batches`)}
                          </div>
                          {max > 0 && (
                            <div style={{ fontSize: 10, color, marginTop: 2 }}>
                              = {maxUnits} {r.output_unit}
                              {lim && ` · ${lang === 'ar' ? 'المحدد:' : 'Limited by:'} ${lim}`}
                            </div>
                          )}
                        </div>
                        {max > 0 && (
                          <button
                            onClick={() => setBatches({ ...batches, [r.id]: max })}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color, borderColor: color }}
                          >
                            {lang === 'ar' ? 'استخدم الكل' : 'Use max'}
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {r.ingredients?.map((ing: any) => {
                      const m = getStk(ing.material)
                      const needed = ing.amount * b
                      const has = m && m.qty >= needed
                      return (
                        <span key={ing.material} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: has ? '#f5f5f3' : '#FCEBEB', color: has ? '#888' : '#A32D2D' }}>
                          {ing.material}: {needed.toFixed(2)} {m?.unit || ''}
                        </span>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>{lang === 'ar' ? 'عدد الصواني:' : 'Batches:'}</span>
                    <button onClick={() => setBatches({ ...batches, [r.id]: Math.max(1, b - 1) })} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
                    <input type="number" value={b} min={1} onChange={e => setBatches({ ...batches, [r.id]: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 50, textAlign: 'center', padding: '4px 6px' }} />
                    <button onClick={() => setBatches({ ...batches, [r.id]: b + 1 })} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#fff', cursor: 'pointer', fontSize: 14 }}>+</button>
                    <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 500 }}>= {units * b} {r.output_unit}</span>
                  </div>

                  <button onClick={() => produce(r)} disabled={!ok || loading === r.id} style={{ width: '100%', padding: '9px 14px', fontSize: 13, borderRadius: 8, border: 'none', cursor: ok ? 'pointer' : 'not-allowed', background: ok ? '#1D9E75' : '#f5f5f3', color: ok ? '#fff' : '#aaa', fontFamily: 'inherit', fontWeight: 500 }}>
                    {loading === r.id ? '...' : ok ? `▶ ${lang === 'ar' ? 'أنتج الآن' : 'Produce'}` : (lang === 'ar' ? 'مواد غير كافية' : 'Insufficient')}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'log' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, alignItems: 'start' }}>

            {/* Calendar */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'center', marginBottom: 10 }}>
                {monthNames[lang][month]} {year}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
                {dayNames[lang].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#888', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {/* Empty cells for first day offset */}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDate
                  const hasData = activeDates.has(dateStr)
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      style={{
                        padding: '6px 0', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: isSelected ? '#1D9E75' : isToday ? '#E1F5EE' : 'transparent',
                        color: isSelected ? '#fff' : isToday ? '#085041' : '#333',
                        fontWeight: isSelected || isToday ? 600 : 400,
                        position: 'relative',
                        fontFamily: 'inherit'
                      }}
                    >
                      {day}
                      {hasData && !isSelected && (
                        <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#1D9E75' }} />
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e5e5e5', fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75' }} />
                {lang === 'ar' ? 'يوجد إنتاج' : 'Has production'}
              </div>
            </div>

            {/* Day log */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              {loadingLog ? (
                <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: '20px 0' }}>...</div>
              ) : filteredLog.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: '20px 0' }}>
                  {lang === 'ar' ? 'لا يوجد إنتاج في هذا اليوم' : 'No production on this day'}
                </div>
              ) : (
                <>
                  {filteredLog.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{l.recipe_name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          {new Date(l.created_at).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 500, color: '#1D9E75', fontSize: 16 }}>{l.output_qty} {l.output_unit}</span>
                        <button onClick={() => { setEditLog(l); setEditQty(String(l.output_qty)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 14, padding: 4 }}>✏️</button>
                        <button onClick={() => deleteLog(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: 4 }}>🗑</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#888' }}>{lang === 'ar' ? 'إجمالي اليوم' : 'Day total'}</span>
                    <span style={{ fontWeight: 500 }}>{filteredLog.reduce((s, l) => s + l.output_qty, 0)} {lang === 'ar' ? 'وحدة' : 'units'}</span>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.produce) return { redirect: { destination: '/', permanent: false } }

  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  const [{ data: recipes }, { data: stock }, { data: todayLog }, { data: monthDates }] = await Promise.all([
    supabaseAdmin.from('recipes').select('*').order('name'),
    supabaseAdmin.from('stock').select('*'),
    supabaseAdmin.from('production_log').select('*').gte('created_at', today + 'T00:00:00').order('created_at', { ascending: false }),
    supabaseAdmin.from('production_log').select('created_at').gte('created_at', monthStart),
  ])

  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [], initialLog: todayLog || [], initialMonthDates: monthDates || [] } }
}
