import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T, Lang } from '../lib/translations'

export default function ProducePage({ user, initialRecipes, initialStock, initialLog }: any) {
  const [lang, setLang] = useState<Lang>('ar')
  const [recipes] = useState<any[]>(initialRecipes || [])
  const [stock, setStock] = useState<any[]>(initialStock || [])
  const [log, setLog] = useState<any[]>(initialLog || [])
  const [loading, setLoading] = useState<string|null>(null)
  const t = T[lang]

  const getStk = (name: string) => stock.find(s => s.name === name)

  const canMake = (recipe: any) =>
    recipe.ingredients?.every((ing: any) => {
      const m = getStk(ing.material)
      return m && m.qty >= ing.amount
    })

  const unitCost = (recipe: any) => {
    const total = recipe.ingredients?.reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0) || 0
    return recipe.output_qty > 0 ? total / recipe.output_qty : 0
  }

  const produce = async (recipe: any) => {
    if (!canMake(recipe)) return
    setLoading(recipe.id)
    const res = await fetch('/api/recipes/produce', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ recipe_id: recipe.id })
    })
    if (res.ok) {
      // Update local stock
      const updated = [...stock]
      recipe.ingredients?.forEach((ing: any) => {
        const m = updated.find(s => s.name === ing.material)
        if (m) m.qty = Math.max(0, m.qty - ing.amount)
      })
      setStock(updated)
      setLog([{ recipe_name: recipe.name, output_qty: recipe.output_qty, output_unit: recipe.output_unit, created_at: new Date().toISOString() }, ...log.slice(0,9)])
    }
    setLoading(null)
  }

  const margin = (recipe: any) => {
    const uc = unitCost(recipe)
    const sp = recipe.sell_price || 0
    return sp > 0 ? ((sp - uc) / sp * 100) : null
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
          {recipes.map(r => {
            const ok = canMake(r)
            const uc = unitCost(r)
            const m = margin(r)
            const marginColor = m === null ? '#888' : m < 0 ? '#A32D2D' : m < 15 ? '#854F0B' : '#3B6D11'
            const marginTag = m === null ? '' : m < 0 ? 'tag-red' : m < 15 ? 'tag-yellow' : 'tag-green'
            return (
              <div key={r.id} className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:500}}>{r.name}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{lang==='ar'?'ينتج':'Produces'}: {r.output_qty} {r.output_unit}</div>
                  </div>
                  {m !== null && <span className={`tag ${marginTag}`}>{m.toFixed(0)}%</span>}
                </div>

                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
                  {r.ingredients?.map((ing: any) => {
                    const m = getStk(ing.material)
                    const has = m && m.qty >= ing.amount
                    return (
                      <span key={ing.material} style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:has?'#f5f5f3':'#FCEBEB',color:has?'#888':'#A32D2D'}}>
                        {ing.material} {ing.amount}{m?.unit||''}
                      </span>
                    )
                  })}
                </div>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:'#888'}}>{t.produce.unitCost}: {uc.toFixed(2)} {t.currency}</span>
                  <button
                    onClick={() => produce(r)}
                    disabled={!ok || loading === r.id}
                    style={{padding:'7px 14px',fontSize:12,borderRadius:8,border:'none',cursor:ok?'pointer':'not-allowed',background:ok?'#1D9E75':'#f5f5f3',color:ok?'#fff':'#aaa',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}
                  >
                    {loading === r.id ? '...' : ok ? `▶ ${t.produce.produceNow}` : t.produce.insufficient}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Log */}
        <div className="card">
          <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>🕐 {t.produce.todayLog}</div>
          {log.length === 0
            ? <div style={{color:'#888',fontSize:13,textAlign:'center',padding:'8px 0'}}>{t.produce.noProduction}</div>
            : log.map((l,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #e5e5e5',fontSize:13}}>
                <span>✅ {l.recipe_name} × {l.output_qty} {l.output_unit}</span>
                <span style={{color:'#888',fontSize:11}}>{new Date(l.created_at).toLocaleTimeString(lang==='ar'?'ar':'en',{hour:'2-digit',minute:'2-digit'})}</span>
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
    supabaseAdmin.from('production_log').select('*').gte('created_at', today).order('created_at', {ascending:false}).limit(10),
  ])

  return { props: { user, initialRecipes: recipes||[], initialStock: stock||[], initialLog: log||[] } }
}
