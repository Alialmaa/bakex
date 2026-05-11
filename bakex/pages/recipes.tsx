import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

export default function RecipesPage({ user, initialRecipes, initialStock }: any) {
  const { lang, setLang } = useLang()
  const [recipes, setRecipes] = useState<any[]>(initialRecipes || [])
  const [stock] = useState<any[]>(initialStock || [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', output_qty: 1, output_unit: 'حبة', sell_price: 0,
    ingredients: [{ material: '', amount: 0 }] as { material: string; amount: number }[]
  })
  const t = T[lang]

  const reset = () => {
    setForm({ name: '', output_qty: 1, output_unit: 'حبة', sell_price: 0, ingredients: [{ material: '', amount: 0 }] })
    setEditing(null)
    setShowForm(false)
  }

  const startEdit = (r: any) => {
    setEditing(r)
    setForm({
      name: r.name,
      output_qty: r.output_qty,
      output_unit: r.output_unit,
      sell_price: r.sell_price || 0,
      ingredients: r.ingredients?.length ? r.ingredients : [{ material: '', amount: 0 }]
    })
    setShowForm(true)
  }

  const addIngredient = () => setForm({ ...form, ingredients: [...form.ingredients, { material: '', amount: 0 }] })
  const removeIngredient = (i: number) => setForm({ ...form, ingredients: form.ingredients.filter((_, idx) => idx !== i) })
  const updateIngredient = (i: number, key: string, value: any) => {
    const ings = [...form.ingredients]
    ings[i] = { ...ings[i], [key]: value }
    setForm({ ...form, ingredients: ings })
  }

  const save = async () => {
    if (!form.name.trim()) return
    const cleaned = form.ingredients.filter(ing => ing.material && ing.amount > 0)
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch('/api/recipes', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, id: editing.id, ingredients: cleaned })
        })
        if (res.ok) {
          const data = await res.json()
          setRecipes(recipes.map(r => r.id === editing.id ? data : r))
          reset()
        }
      } else {
        const res = await fetch('/api/recipes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, ingredients: cleaned })
        })
        if (res.ok) {
          const data = await res.json()
          setRecipes([...recipes, data])
          reset()
        }
      }
    } finally { setSaving(false) }
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف الوصفة؟' : 'Delete recipe?')) return
    await fetch('/api/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setRecipes(recipes.filter(r => r.id !== id))
  }

  const getCost = (r: any) => {
    const total = (r.ingredients || []).reduce((s: number, ing: any) => {
      const m = stock.find(x => x.name === ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    return r.output_qty > 0 ? total / r.output_qty : 0
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#888' }}>
            {lang === 'ar' ? `${recipes.length} وصفة` : `${recipes.length} recipes`}
          </div>
          <button className="btn btn-primary" onClick={() => { reset(); setShowForm(!showForm) }} style={{ fontSize: 13 }}>
            {showForm ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? '+ وصفة جديدة' : '+ New Recipe')}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
              {editing ? (lang === 'ar' ? 'تعديل وصفة' : 'Edit Recipe') : (lang === 'ar' ? 'وصفة جديدة' : 'New Recipe')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'اسم الوصفة' : 'Recipe name'}</div>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: خبز البر' : 'e.g. Wheat bread'} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'الكمية المنتجة' : 'Output qty'}</div>
                <input type="number" value={form.output_qty} min={1} onChange={e => setForm({ ...form, output_qty: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'الوحدة' : 'Unit'}</div>
                <input type="text" value={form.output_unit} onChange={e => setForm({ ...form, output_unit: e.target.value })} placeholder={lang === 'ar' ? 'حبة، صينية، رغيف' : 'piece, tray'} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{lang === 'ar' ? 'سعر البيع (للوحدة)' : 'Sell price (per unit)'}</div>
              <input type="number" value={form.sell_price} min={0} step={0.5} onChange={e => setForm({ ...form, sell_price: parseFloat(e.target.value) || 0 })} style={{ maxWidth: 200 }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>{lang === 'ar' ? 'المكونات' : 'Ingredients'}</div>
                <button onClick={addIngredient} className="btn" style={{ fontSize: 11, padding: '4px 10px' }}>+ {lang === 'ar' ? 'إضافة مكون' : 'Add ingredient'}</button>
              </div>
              {form.ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 30px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <select value={ing.material} onChange={e => updateIngredient(i, 'material', e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid #d4d4d4', fontSize: 13, background: '#fff' }}>
                    <option value="">{lang === 'ar' ? '-- اختر المادة --' : '-- Select material --'}</option>
                    {stock.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.unit})</option>
                    ))}
                  </select>
                  <input type="number" value={ing.amount} min={0} step={0.01} onChange={e => updateIngredient(i, 'amount', parseFloat(e.target.value) || 0)} placeholder={lang === 'ar' ? 'الكمية' : 'Amount'} />
                  {form.ingredients.length > 1 && (
                    <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 16 }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={save} disabled={saving}>
              {saving ? '...' : (editing ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save changes') : (lang === 'ar' ? 'إضافة الوصفة' : 'Add Recipe'))}
            </button>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 100px auto', gap: 8, padding: '10px 16px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <span>{lang === 'ar' ? 'الوصفة' : 'Recipe'}</span>
            <span>{lang === 'ar' ? 'الإنتاج' : 'Output'}</span>
            <span>{lang === 'ar' ? 'سعر البيع' : 'Sell Price'}</span>
            <span>{lang === 'ar' ? 'كوست الحبة' : 'Unit Cost'}</span>
            <span>{lang === 'ar' ? 'هامش' : 'Margin'}</span>
            <span></span>
          </div>
          <div style={{ padding: '0 16px' }}>
            {recipes.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
                {lang === 'ar' ? 'لا توجد وصفات بعد. اضغط "+ وصفة جديدة" لإضافة وصفة.' : 'No recipes yet. Click "+ New Recipe" to add one.'}
              </div>
            ) : recipes.map(r => {
              const cost = getCost(r)
              const margin = r.sell_price > 0 ? ((r.sell_price - cost) / r.sell_price * 100) : null
              const mc = margin === null ? '#888' : margin < 0 ? '#A32D2D' : margin < 15 ? '#854F0B' : '#3B6D11'
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 100px auto', gap: 8, alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>
                      {(r.ingredients || []).length} {lang === 'ar' ? 'مكون' : 'ingredients'}
                    </div>
                  </div>
                  <span style={{ color: '#888', fontSize: 12 }}>{r.output_qty} {r.output_unit}</span>
                  <span>{r.sell_price?.toFixed(2)} {t.currency}</span>
                  <span style={{ color: '#888' }}>{cost.toFixed(2)} {t.currency}</span>
                  <span style={{ color: mc, fontWeight: 500 }}>{margin !== null ? margin.toFixed(0) + '%' : '—'}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 14, padding: 4 }}>✏️</button>
                    <button onClick={() => deleteRecipe(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: 4 }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.produce) return { redirect: { destination: '/', permanent: false } }
  const [{ data: recipes }, { data: stock }] = await Promise.all([
    supabaseAdmin.from('recipes').select('*').order('name'),
    supabaseAdmin.from('stock').select('*').order('name'),
  ])
  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [] } }
}
