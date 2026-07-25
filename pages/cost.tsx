import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function CostPage({ user, initialRecipes, initialStock }: any) {
  const { lang, setLang } = useLang()
  const [recipes, setRecipes] = useState<any[]>(initialRecipes || [])
  const [stock] = useState<any[]>(initialStock || [])
  const [selectedId, setSelectedId] = useState<string>(recipes[0]?.id || '')
  const [sellPrice, setSellPrice] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const selected = recipes.find(r => r.id === selectedId) || null

  useEffect(() => {
    if (selected) setSellPrice(selected.sell_price || 0)
  }, [selectedId])

  const getStk = (name: string) => stock.find(s => s.name === name)

  const calcUnitCost = (recipe: any) => {
    if (!recipe) return 0
    const total = (recipe.ingredients || []).reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    const units = recipe.units_per_batch || recipe.output_qty
    return units > 0 ? total / units : 0
  }

  if (recipes.length === 0) {
    return (
      <Layout user={user} lang={lang} setLang={setLang}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, color: '#888' }}>
            {lang === 'ar' ? 'لا توجد وصفات. أضف وصفات أولاً من صفحة الوصفات.' : 'No recipes. Add recipes first from the Recipes page.'}
          </div>
        </div>
      </Layout>
    )
  }

  const unitCost = calcUnitCost(selected)
  const batchCost = unitCost * (selected?.units_per_batch || selected?.output_qty || 1)
  const profit = sellPrice - unitCost
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : null
  const suggested = unitCost > 0 ? (unitCost / 0.7).toFixed(2) : null
  const breakeven = profit > 0 ? Math.ceil(batchCost / profit) : null
  const barColor = margin === null ? '#d4d4d4' : margin < 0 ? '#E24B4A' : margin < 15 ? '#EF9F27' : '#1D9E75'
  const profitColor = margin === null ? '#888' : margin < 0 ? '#A32D2D' : margin < 15 ? '#854F0B' : '#3B6D11'

  const saveSellPrice = async () => {
    if (!selected) return
    setSaving(true)
    await fetch('/api/recipes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, sell_price: sellPrice })
    })
    setRecipes(recipes.map(r => r.id === selected.id ? { ...r, sell_price: sellPrice } : r))
    setSaving(false)
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {recipes.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{
                padding: '8px 15px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid', transition: 'all 0.15s',
                background: selectedId === r.id ? '#ecfdf5' : '#fff',
                color: selectedId === r.id ? '#065f46' : '#6b7280',
                borderColor: selectedId === r.id ? '#16a679' : '#e5e7eb',
                fontWeight: selectedId === r.id ? 600 : 500,
                boxShadow: selectedId === r.id ? '0 1px 3px rgba(22,166,121,0.18)' : '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >{r.name}</button>
          ))}
        </div>

        {selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>
                <span className="ico-md" style={{ color: '#7c3aed' }}>{Icons.chef}</span>
                {selected.name} — {lang === 'ar' ? 'المكونات' : 'Ingredients'}
              </div>
              {(selected.ingredients || []).length === 0 ? (
                <div className="tbl-empty" style={{ padding: '18px 0' }}>
                  {lang === 'ar' ? 'لا توجد مكونات. عدّل الوصفة من صفحة الوصفات.' : 'No ingredients. Edit recipe from Recipes page.'}
                </div>
              ) : (
                <>
                  <div className="thead" style={{ gridTemplateColumns: '1.3fr 70px 80px 70px', gap: 6, margin: '0 -18px', paddingInline: 18, background: 'transparent' }}>
                    <span>{lang === 'ar' ? 'المادة' : 'Material'}</span>
                    <span>{lang === 'ar' ? 'الكمية' : 'Qty'}</span>
                    <span>{lang === 'ar' ? 'السعر' : 'Price'}</span>
                    <span>{lang === 'ar' ? 'المجموع' : 'Total'}</span>
                  </div>
                  {(selected.ingredients || []).map((ing: any, i: number) => {
                    const m = getStk(ing.material)
                    const p = m?.price_per_unit || 0
                    return (
                      <div key={i} className="trow" style={{ gridTemplateColumns: '1.3fr 70px 80px 70px', gap: 6, margin: '0 -18px', paddingInline: 18 }}>
                        <span style={{ fontWeight: 500, minWidth: 0 }}>{ing.material}{!m && <span className="tag tag-red" style={{ fontSize: 10, marginInlineStart: 5 }}>{lang === 'ar' ? 'غير موجود' : 'not found'}</span>}</span>
                        <span className="num" style={{ color: '#9ca3af' }}>{ing.amount} {m?.unit || ''}</span>
                        <span className="num" style={{ color: '#059669', fontSize: 12.5 }}>{p.toFixed(4)}</span>
                        <span className="num" style={{ fontWeight: 600 }}>{(ing.amount * p).toFixed(2)}</span>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span className="num" style={{ color: '#9ca3af', fontWeight: 500 }}>{selected.units_per_batch || selected.output_qty} {selected.output_unit}</span>
                    <span className="num" style={{ fontWeight: 700 }}>{batchCost.toFixed(2)} {t.currency}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MetricCard
                  label={t.cost.unitCost} value={unitCost.toFixed(2)} unit={t.currency}
                  sub={lang === 'ar' ? `لكل ${selected.output_unit}` : `per ${selected.output_unit}`}
                  icon={Icons.tag} tone="blue"
                />
                <MetricCard
                  label={lang === 'ar' ? 'تكلفة الدفعة' : 'Batch Cost'} value={batchCost.toFixed(2)} unit={t.currency}
                  sub={lang === 'ar' ? `لكل ${selected.batch_unit || selected.output_unit}` : `per ${selected.batch_unit || selected.output_unit}`}
                  icon={Icons.box} tone="violet"
                />
              </div>
              <div className="card">
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 7 }}>{t.cost.sellPrice}</div>
                <input type="number" value={sellPrice} min={0} step={0.5} onChange={e => setSellPrice(parseFloat(e.target.value) || 0)} style={{ fontSize: 16, fontWeight: 600, padding: '10px 12px', marginBottom: 12 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#9ca3af', fontWeight: 500 }}>{t.cost.profit}</span>
                  <span className="num" style={{ fontWeight: 700, color: profitColor }}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)} {t.currency}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: '#9ca3af', fontWeight: 500 }}>{t.cost.margin}</span>
                  <span className="num" style={{ fontWeight: 700, color: profitColor }}>{margin !== null ? margin.toFixed(1) + '%' : '—'}</span>
                </div>
                <button onClick={saveSellPrice} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 13 }}>
                  {saving ? '...' : (lang === 'ar' ? 'حفظ السعر' : 'Save Price')}
                </button>
              </div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                  <span style={{ color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>{t.cost.margin}</span>
                  <span className="num" style={{ color: barColor, fontWeight: 700 }}>{margin !== null ? margin.toFixed(1) + '%' : '—'}</span>
                </div>
                <div className="bar-wrap"><div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, margin || 0))}%`, background: barColor }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>{t.cost.breakeven}</div><div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{breakeven ? `${breakeven} ${selected.output_unit}` : '—'}</div></div>
                  <div><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>{t.cost.suggested}</div><div className="num" style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{suggested ? `${suggested} ${t.currency}` : '—'}</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { anyPerm: ['cost'] })
  if (isRedirect(guard)) return guard
  const { user } = guard
  const bid = user.bakery_id
  const [{ data: recipes }, { data: stock }] = await Promise.all([
    bid ? supabaseAdmin.from('recipes').select('*').eq('bakery_id', bid).order('name') : supabaseAdmin.from('recipes').select('*').order('name'),
    bid ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bid) : supabaseAdmin.from('stock').select('*'),
  ])
  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [] } }
}
