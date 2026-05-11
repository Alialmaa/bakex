import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T, Lang } from '../lib/translations'

export default function CostPage({ user, initialRecipes, initialStock }: any) {
  const [lang, setLang] = useState<Lang>('ar')
  const [recipes] = useState<any[]>(initialRecipes || [])
  const [stock] = useState<any[]>(initialStock || [])
  const [selected, setSelected] = useState<any>(recipes[0] || null)
  const [sellPrice, setSellPrice] = useState<number>(recipes[0]?.sell_price || 0)
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const selectRecipe = (r: any) => {
    setSelected(r)
    setSellPrice(r.sell_price || 0)
  }

  const getStk = (name: string) => stock.find(s => s.name === name)

  const calcUnitCost = (recipe: any) => {
    if (!recipe) return 0
    const total = (recipe.ingredients || []).reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    return recipe.output_qty > 0 ? total / recipe.output_qty : 0
  }

  const unitCost = calcUnitCost(selected)
  const batchCost = unitCost * (selected?.output_qty || 1)
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
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, sell_price: sellPrice }),
    })
    setSaving(false)
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Recipe tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {recipes.map(r => (
            <button
              key={r.id}
              onClick={() => selectRecipe(r)}
              style={{
                padding: '7px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', border: '0.5px solid',
                background: selected?.id === r.id ? '#E1F5EE' : '#fff',
                color: selected?.id === r.id ? '#085041' : '#888',
                borderColor: selected?.id === r.id ? '#1D9E75' : '#d4d4d4',
                fontWeight: selected?.id === r.id ? 500 : 400,
              }}
            >
              {r.name}
            </button>
          ))}
        </div>

        {selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Ingredients */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
                {selected.name} — {t.cost.ingredients}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 70px 80px 70px', gap: 6, padding: '4px 0 8px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
                <span>{lang === 'ar' ? 'المادة' : 'Material'}</span>
                <span>{lang === 'ar' ? 'الكمية' : 'Qty'}</span>
                <span>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</span>
                <span>{lang === 'ar' ? 'المجموع' : 'Total'}</span>
              </div>
              {(selected.ingredients || []).map((ing: any, i: number) => {
                const m = getStk(ing.material)
                const p = m?.price_per_unit || 0
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 70px 80px 70px', gap: 6, padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {ing.material}
                      <span style={{ fontSize: 10, color: '#1D9E75' }}>●</span>
                    </span>
                    <span style={{ color: '#888' }}>{ing.amount} {m?.unit || ''}</span>
                    <span style={{ color: '#1D9E75', fontSize: 12 }}>{p.toFixed(2)} {t.currency}</span>
                    <span>{(ing.amount * p).toFixed(2)} {t.currency}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e5e5e5', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'الدفعة' : 'Batch'}: {selected.output_qty} {selected.output_unit}</span>
                <span>{lang === 'ar' ? 'الإجمالي' : 'Total'}: <strong>{batchCost.toFixed(2)} {t.currency}</strong></span>
              </div>
            </div>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="metric">
                  <div className="metric-label">{t.cost.unitCost}</div>
                  <div className="metric-value">{unitCost.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div>
                </div>
                <div className="metric">
                  <div className="metric-label">{lang === 'ar' ? 'تكلفة الدفعة' : 'Batch Cost'}</div>
                  <div className="metric-value">{batchCost.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 400 }}>{t.currency}</span></div>
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 6 }}>{t.cost.sellPrice}</div>
                <input
                  type="number"
                  value={sellPrice}
                  min={0}
                  step={0.5}
                  onChange={e => setSellPrice(parseFloat(e.target.value) || 0)}
                  style={{ fontSize: 16, padding: '9px 12px', marginBottom: 10 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>{t.cost.profit}</span>
                  <span style={{ fontWeight: 500, color: profitColor }}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)} {t.currency}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: '#888' }}>{t.cost.margin}</span>
                  <span style={{ fontWeight: 500, color: profitColor }}>{margin !== null ? margin.toFixed(1) + '%' : '—'}</span>
                </div>
                <button onClick={saveSellPrice} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 13 }}>
                  {saving ? '...' : (lang === 'ar' ? 'حفظ السعر' : 'Save Price')}
                </button>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#888' }}>{t.cost.margin}</span>
                  <span style={{ color: barColor, fontWeight: 500 }}>{margin !== null ? margin.toFixed(1) + '%' : '—'}</span>
                </div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, margin || 0))}%`, background: barColor }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{t.cost.breakeven}</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{breakeven ? `${breakeven} ${selected.output_unit}` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{t.cost.suggested}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#1D9E75' }}>{suggested ? `${suggested} ${t.currency}` : '—'}</div>
                  </div>
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
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.cost) return { redirect: { destination: '/', permanent: false } }

  const [{ data: recipes }, { data: stock }] = await Promise.all([
    supabaseAdmin.from('recipes').select('*').order('name'),
    supabaseAdmin.from('stock').select('*'),
  ])

  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [] } }
}
