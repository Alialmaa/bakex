import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function ProducePage({ user, initialRecipes, initialStock, initialLog }: any) {
  const { lang, setLang } = useLang()
  const [recipes] = useState<any[]>(initialRecipes || [])
  const [stock, setStock] = useState<any[]>(initialStock || [])
  const [log, setLog] = useState<any[]>(initialLog || [])
  const [loading, setLoading] = useState<string | null>(null)
  const [batches, setBatches] = useState<Record<string, number>>({})
  const t = T[lang]

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
    return recipe.output_qty > 0 ? total / recipe.output_qty : 0
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
      setLog([{ recipe_name: recipe.name, output_qty: recipe.output_qty * b, output_unit: recipe.output_unit, created_at: new Date().toISOString() }, ...log.slice(0, 9)])
      setBatches({ ...batches, [recipe.id]: 1 })
    } else {
      const err = await res.json()
      alert(err.error || 'Error')
    }
    setLoading(null)
  }

  if (recipes.length === 0) {
    return (
      <Layout user={user} lang={lang} setLang={setLang}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>
            {lang === 'ar' ? 'لا توجد وصفات. أضف وصفات أولاً من صفحة الوصفات.' : 'No recipes yet. Add recipes from the Recipes page first.'}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {recipes.map(r => {
            const b = batches[r.id] || 1
            const ok = canMake(r, b)
            const uc = unitCost(r)
            return (
              <div key={r.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {lang === 'ar' ? 'الدفعة الواحدة تنتج' : 'Per batch'}: {r.output_qty} {r.output_unit}
                    </div>
                  </div>
                  <span className="tag tag-gray" style={{ fontSize: 11 }}>{uc.toFixed(2)} {t.currency}/{r.output_unit}</span>
                </div>

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
                  <span style={{ fontSize: 12, color: '#666' }}>{lang === 'ar' ? 'عدد الدفعات:' : 'Batches:'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setBatches({ ...batches, [r.id]: Math.max(1, b - 1) })} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
                    <input type="number" value={b} min={1} onChange={e => setBatches({ ...batches, [r.id]: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 50, textAlign: 'center', padding: '4px 6px' }} />
                    <button onClick={() => setBatches({ ...batches, [r.id]: b + 1 })} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #d4d4d4', background: '#fff', cursor: 'pointer', fontSize: 14 }}>+</button>
                  </div>
                  <span style={{ fontSize: 11, color: '#888', marginRight: 'auto', marginLeft: 'auto' }}>
                    = {r.output_qty * b} {r.output_unit}
                  </span>
                </div>

                <button
                  onClick={() => produce(r)}
                  disabled={!ok || loading === r.id}
                  style={{ width: '100%', padding: '9px 14px', fontSize: 13, borderRadius: 8, border: 'none', cursor: ok ? 'pointer' : 'not-allowed', background: ok ? '#1D9E75' : '#f5f5f3', color: ok ? '#fff' : '#aaa', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  {loading === r.id ? '...' : ok ? `▶ ${lang === 'ar' ? 'أنتج الآن' : 'Produce Now'}` : (lang === 'ar' ? 'مواد غير كافية' : 'Insufficient stock')}
                </button>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🕐 {lang === 'ar' ? 'سجل إنتاج اليوم' : "Today's Production Log"}</div>
          {log.length === 0
            ? <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>{lang === 'ar' ? 'لا يوجد إنتاج بعد' : 'No production yet'}</div>
            : log.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                <span>✅ {l.recipe_name} × {l.output_qty} {l.output_unit}</span>
                <span style={{ color: '#888', fontSize: 11 }}>{new Date(l.created_at).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
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
  if (!user.perms?.produce) return { redirect: { destination: '/', permanent: false } }

  const today = new Date().toISOString().split('T')[0]
  const [{ data: recipes }, { data: stock }, { data: log }] = await Promise.all([
    supabaseAdmin.from('recipes').select('*').order('name'),
    supabaseAdmin.from('stock').select('*'),
    supabaseAdmin.from('production_log').select('*').gte('created_at', today).order('created_at', { ascending: false }).limit(10),
  ])

  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [], initialLog: log || [] } }
}
