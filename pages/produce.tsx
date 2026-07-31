import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons, EditIcon, TrashIcon } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'
import { fmtDateLong, fmtTime, fromDayString } from '../lib/datetime'
import { businessToday, dayStart, dayEnd, monthStart as monthStartOf, isOnDay } from '../lib/businessDay'

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
  const [selectedDate, setSelectedDate] = useState<string>(businessToday())
  const [filteredLog, setFilteredLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const t = T[lang]

  // Build calendar for current month
  const todayStr = businessToday()
  const year = Number(todayStr.slice(0, 4))
  const month = Number(todayStr.slice(5, 7)) - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

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
            <div className="modal-box" style={{ width: 360 }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="card-title" style={{ marginBottom: 6 }}>{lang === 'ar' ? 'تعديل إنتاج' : 'Edit production'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>{editLog.recipe_name}</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>{lang === 'ar' ? `الكمية (${editLog.output_unit})` : `Qty (${editLog.output_unit})`}</div>
                <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} style={{ fontSize: 16, fontWeight: 600 }} autoFocus />
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

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <MetricCard
            label={lang === 'ar' ? 'إنتاج اليوم' : "Today's Output"}
            value={log.reduce((s, l) => s + (l.output_qty || 0), 0)}
            sub={lang === 'ar' ? `${log.length} دفعة مسجّلة` : `${log.length} batches logged`}
            icon={Icons.factory} tone="green"
          />
          <MetricCard
            label={lang === 'ar' ? 'وصفات جاهزة' : 'Ready to Produce'}
            value={recipes.filter(r => maxBatches(r) > 0).length}
            sub={lang === 'ar' ? `من أصل ${recipes.length} وصفة` : `of ${recipes.length} recipes`}
            icon={Icons.chef} tone="blue"
          />
          <MetricCard
            label={lang === 'ar' ? 'موقوفة لنقص المواد' : 'Blocked by Stock'}
            value={recipes.filter(r => maxBatches(r) === 0).length}
            sub={lang === 'ar' ? 'المخزون لا يكفي' : 'insufficient materials'}
            icon={Icons.alert} tone="amber"
            valueColor={recipes.some(r => maxBatches(r) === 0) ? '#d97706' : undefined}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 7 }}>
          {([
            { k: 'produce' as const, icon: Icons.factory, label: lang === 'ar' ? 'إنتاج' : 'Produce' },
            { k: 'log' as const, icon: Icons.calendar, label: lang === 'ar' ? 'السجل' : 'Log' },
          ]).map(({ k, icon, label }) => {
            const on = tab === k
            return (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: '8px 18px', fontSize: 13, borderRadius: 8, border: '1px solid', cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                background: on ? '#16a679' : '#fff', color: on ? '#fff' : '#6b7280',
                borderColor: on ? '#16a679' : '#e5e7eb', fontWeight: on ? 600 : 500,
                boxShadow: on ? '0 1px 3px rgba(22,166,121,0.25)' : '0 1px 2px rgba(0,0,0,0.05)',
              }}>
                <span className="ico-sm" style={{ opacity: on ? 1 : 0.6 }}>{icon}</span>{label}
              </button>
            )
          })}
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>
                        {r.batch_unit || 'صينية'} <span style={{ color: '#d1d5db' }}>→</span> <span className="num">{units}</span> {r.output_unit}
                      </div>
                    </div>
                    <span className="tag tag-gray num" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{uc.toFixed(3)} {t.currency}/{r.output_unit}</span>
                  </div>

                  {/* Max batches indicator */}
                  {(() => {
                    const max = maxBatches(r)
                    const lim = limitingIngredient(r)
                    const maxUnits = max * units
                    const color = max === 0 ? '#dc2626' : max < 3 ? '#d97706' : '#059669'
                    const bg = max === 0 ? '#fef2f2' : max < 3 ? '#fffbeb' : '#ecfdf5'
                    const bd = max === 0 ? '#fecaca' : max < 3 ? '#fde68a' : '#a7f3d0'
                    return (
                      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '10px 13px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, color, fontWeight: 600 }}>
                            {max === 0
                              ? (lang === 'ar' ? 'المخزون لا يكفي' : 'Insufficient stock')
                              : (lang === 'ar' ? `تقدر تنتج ${max} ${r.batch_unit || 'صينية'}` : `Can produce ${max} batches`)}
                          </div>
                          {max > 0 && (
                            <div className="num" style={{ fontSize: 10.5, color, opacity: 0.8, marginTop: 3 }}>
                              = {maxUnits} {r.output_unit}
                              {lim && ` · ${lang === 'ar' ? 'المحدد:' : 'Limited by:'} ${lim}`}
                            </div>
                          )}
                        </div>
                        {max > 0 && (
                          <button
                            onClick={() => setBatches({ ...batches, [r.id]: max })}
                            style={{ fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color, borderColor: bd, whiteSpace: 'nowrap' }}
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
                        <span key={ing.material} className="num" style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: has ? '#f3f4f6' : '#fef2f2', color: has ? '#6b7280' : '#991b1b' }}>
                          {ing.material}: {needed.toFixed(2)} {m?.unit || ''}
                        </span>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{lang === 'ar' ? 'عدد الصواني:' : 'Batches:'}</span>
                    <button onClick={() => setBatches({ ...batches, [r.id]: Math.max(1, b - 1) })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 15, color: '#6b7280', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>−</button>
                    <input type="number" value={b} min={1} onChange={e => setBatches({ ...batches, [r.id]: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 54, textAlign: 'center', padding: '5px 6px', fontWeight: 600 }} />
                    <button onClick={() => setBatches({ ...batches, [r.id]: b + 1 })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 15, color: '#6b7280', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>+</button>
                    <span className="num" style={{ fontSize: 11.5, color: '#059669', fontWeight: 600 }}>= {units * b} {r.output_unit}</span>
                  </div>

                  <button onClick={() => produce(r)} disabled={!ok || loading === r.id} style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 8, border: 'none', cursor: ok ? 'pointer' : 'not-allowed', background: ok ? '#16a679' : '#f3f4f6', color: ok ? '#fff' : '#9ca3af', fontFamily: 'inherit', fontWeight: 600, boxShadow: ok ? '0 1px 3px rgba(22,166,121,0.25)' : 'none', transition: 'all 0.15s' }}>
                    {loading === r.id ? '...' : ok ? (lang === 'ar' ? 'أنتج الآن' : 'Produce now') : (lang === 'ar' ? 'مواد غير كافية' : 'Insufficient materials')}
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
              <div className="num" style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'center', marginBottom: 14, letterSpacing: '-0.1px' }}>
                {monthNames[lang][month]} {year}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
                {dayNames[lang].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
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
                      className="num"
                      style={{
                        padding: '7px 0', fontSize: 12, borderRadius: 7, border: 'none', cursor: 'pointer',
                        background: isSelected ? '#16a679' : isToday ? '#ecfdf5' : 'transparent',
                        color: isSelected ? '#fff' : isToday ? '#065f46' : '#374151',
                        fontWeight: isSelected || isToday ? 700 : 500,
                        position: 'relative',
                        fontFamily: 'inherit',
                        transition: 'background 0.13s',
                      }}
                    >
                      {day}
                      {hasData && !isSelected && (
                        <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#16a679' }} />
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 11.5, color: '#9ca3af', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a679', flexShrink: 0 }} />
                {lang === 'ar' ? 'يوجد إنتاج' : 'Has production'}
              </div>
            </div>

            {/* Day log */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>
                <span className="ico-sm" style={{ color: '#9ca3af' }}>{Icons.calendar}</span>
                <span suppressHydrationWarning>{fmtDateLong(fromDayString(selectedDate), lang)}</span>
              </div>
              {loadingLog ? (
                <div className="tbl-empty" style={{ padding: '24px 0' }}>...</div>
              ) : filteredLog.length === 0 ? (
                <div className="tbl-empty" style={{ padding: '24px 0' }}>
                  {lang === 'ar' ? 'لا يوجد إنتاج في هذا اليوم' : 'No production on this day'}
                </div>
              ) : (
                <>
                  {filteredLog.map(l => (
                    <div key={l.id} className="trow" style={{ gridTemplateColumns: '1fr auto', gap: 10, margin: '0 -18px', paddingInline: 18 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{l.recipe_name}</div>
                        <div className="num" style={{ fontSize: 11.5, color: '#9ca3af' }} suppressHydrationWarning>
                          {fmtTime(l.created_at, lang)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="num" style={{ fontWeight: 700, color: '#059669', fontSize: 15 }}>{l.output_qty} <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500 }}>{l.output_unit}</span></span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="ibtn ibtn-edit" title={lang === 'ar' ? 'تعديل' : 'Edit'} onClick={() => { setEditLog(l); setEditQty(String(l.output_qty)) }}><EditIcon /></button>
                          <button className="ibtn ibtn-del" title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => deleteLog(l.id)}><TrashIcon /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#9ca3af', fontWeight: 500 }}>{lang === 'ar' ? 'إجمالي اليوم' : 'Day total'}</span>
                    <span className="num" style={{ fontWeight: 700 }}>{filteredLog.reduce((s, l) => s + l.output_qty, 0)} {lang === 'ar' ? 'وحدة' : 'units'}</span>
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
  const guard = await requirePage(req as any, { anyPerm: ['produce'] })
  if (isRedirect(guard)) return guard
  const { user } = guard

  const today = businessToday()
  const monthStart = monthStartOf(today)

  const bid = user.bakery_id
  const [{ data: recipes }, { data: stock }, { data: todayLog }, { data: monthDates }] = await Promise.all([
    bid ? supabaseAdmin.from('recipes').select('*').eq('bakery_id', bid).order('name') : supabaseAdmin.from('recipes').select('*').order('name'),
    bid ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bid) : supabaseAdmin.from('stock').select('*'),
    bid ? supabaseAdmin.from('production_log').select('*').eq('bakery_id', bid).gte('created_at', dayStart(today)).order('created_at', { ascending: false }) : supabaseAdmin.from('production_log').select('*').gte('created_at', dayStart(today)).order('created_at', { ascending: false }),
    bid ? supabaseAdmin.from('production_log').select('created_at').eq('bakery_id', bid).gte('created_at', dayStart(monthStart)) : supabaseAdmin.from('production_log').select('created_at').gte('created_at', dayStart(monthStart)),
  ])

  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [], initialLog: todayLog || [], initialMonthDates: monthDates || [] } }
}
