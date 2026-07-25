import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons, EditIcon, TrashIcon } from '../components/Metric'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

const COLS = '2fr 130px 90px 100px 100px 90px 64px'

export default function RecipesPage({ user, initialRecipes, initialStock }: any) {
  const { lang, setLang } = useLang()
  const [recipes, setRecipes] = useState<any[]>(initialRecipes || [])
  const [stock] = useState<any[]>(initialStock || [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    batch_unit: 'صينية',      // e.g. صينية / وجبة / دفعة
    units_per_batch: 12,       // how many pieces per batch unit
    output_unit: 'حبة',        // e.g. حبة / قطعة
    sell_price: '',            // price per output_unit
    ingredients: [{ material: '', amount: '' }] as { material: string; amount: string }[]
  })
  const t = T[lang]

  const reset = () => {
    setForm({ name: '', batch_unit: 'صينية', units_per_batch: 12, output_unit: 'حبة', sell_price: '', ingredients: [{ material: '', amount: '' }] })
    setEditing(null)
    setShowForm(false)
  }

  const startEdit = (r: any) => {
    setEditing(r)
    setForm({
      name: r.name,
      batch_unit: r.batch_unit || 'صينية',
      units_per_batch: r.units_per_batch || r.output_qty || 12,
      output_unit: r.output_unit || 'حبة',
      sell_price: r.sell_price !== undefined && r.sell_price !== null ? String(r.sell_price) : '',
      ingredients: r.ingredients?.length ? r.ingredients.map((i: any) => ({ material: i.material, amount: String(i.amount) })) : [{ material: '', amount: '' }]
    })
    setShowForm(true)
  }

  const addIng = () => setForm({ ...form, ingredients: [...form.ingredients, { material: '', amount: '' }] })
  const removeIng = (i: number) => setForm({ ...form, ingredients: form.ingredients.filter((_, idx) => idx !== i) })
  const updateIng = (i: number, key: string, value: string) => {
    const ings = [...form.ingredients]
    ings[i] = { ...ings[i], [key]: value }
    setForm({ ...form, ingredients: ings })
  }

  const save = async () => {
    if (!form.name.trim()) return
    const cleaned = form.ingredients.filter(ing => ing.material && parseFloat(ing.amount) > 0).map(ing => ({ material: ing.material, amount: parseFloat(ing.amount) }))
    const payload = {
      name: form.name,
      batch_unit: form.batch_unit,
      units_per_batch: form.units_per_batch,
      output_qty: form.units_per_batch,  // keep backward compat
      output_unit: form.output_unit,
      sell_price: form.sell_price !== '' ? parseFloat(form.sell_price) : 0,
      ingredients: cleaned
    }
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch('/api/recipes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: editing.id }) })
        if (res.ok) { const data = await res.json(); setRecipes(recipes.map(r => r.id === editing.id ? data : r)); reset() }
      } else {
        const res = await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) { const data = await res.json(); setRecipes([...recipes, data]); reset() }
      }
    } finally { setSaving(false) }
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف الوصفة؟' : 'Delete recipe?')) return
    await fetch('/api/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setRecipes(recipes.filter(r => r.id !== id))
  }

  const getStk = (name: string) => stock.find(s => s.name === name)

  const getBatchCost = (r: any) => {
    return (r.ingredients || []).reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
  }

  const getUnitCost = (r: any) => {
    const batchCost = getBatchCost(r)
    const units = r.units_per_batch || r.output_qty || 1
    return units > 0 ? batchCost / units : 0
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <MetricCard
            label={lang === 'ar' ? 'الوصفات' : 'Recipes'}
            value={recipes.length}
            sub={lang === 'ar' ? 'وصفة مسجّلة' : 'recipes defined'}
            icon={Icons.chef} tone="violet"
          />
          <MetricCard
            label={lang === 'ar' ? 'متوسط كوست الحبة' : 'Avg Unit Cost'}
            value={(recipes.length ? recipes.reduce((s, r) => s + getUnitCost(r), 0) / recipes.length : 0).toFixed(3)}
            unit={t.currency}
            sub={lang === 'ar' ? 'على مستوى كل الوصفات' : 'across all recipes'}
            icon={Icons.wallet} tone="blue"
          />
          {(() => {
            const withPrice = recipes.filter(r => (r.sell_price || 0) > 0)
            const avgMargin = withPrice.length
              ? withPrice.reduce((s, r) => s + ((r.sell_price - getUnitCost(r)) / r.sell_price) * 100, 0) / withPrice.length
              : null
            return (
              <MetricCard
                label={lang === 'ar' ? 'متوسط الهامش' : 'Avg Margin'}
                value={avgMargin === null ? '—' : avgMargin.toFixed(1)}
                unit={avgMargin === null ? undefined : '%'}
                sub={lang === 'ar' ? `${withPrice.length} وصفة لها سعر بيع` : `${withPrice.length} priced recipes`}
                icon={Icons.percent}
                tone={avgMargin === null ? 'slate' : avgMargin < 15 ? 'amber' : 'green'}
                valueColor={avgMargin === null ? undefined : avgMargin < 0 ? '#dc2626' : avgMargin < 15 ? '#d97706' : '#059669'}
              />
            )
          })()}
        </div>

        <div className="page-head">
          <div className="page-head-sub">{lang === 'ar' ? 'أدر وصفاتك ومكوّناتها وأسعار بيعها' : 'Manage recipes, ingredients and selling prices'}</div>
          <button className="btn btn-primary" onClick={() => { reset(); setShowForm(!showForm) }}>
            {showForm ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? '+ وصفة جديدة' : '+ New Recipe')}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>
              {editing ? (lang === 'ar' ? 'تعديل وصفة' : 'Edit Recipe') : (lang === 'ar' ? 'وصفة جديدة' : 'New Recipe')}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'اسم الوصفة' : 'Recipe name'}</div>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: كيكة الشوكلت' : 'e.g. Chocolate cake'} />
            </div>

            {/* Batch definition */}
            <div style={{ background: '#f5f5f3', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#555', marginBottom: 10 }}>
                <span className="ico-sm" style={{ verticalAlign: '-2px', marginInlineEnd: 6 }}>{Icons.box}</span>
                {lang === 'ar' ? 'وحدة الإنتاج' : 'Production unit'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 1fr', gap: 10, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'وحدة الدفعة' : 'Batch unit'}</div>
                  <input type="text" value={form.batch_unit} onChange={e => setForm({ ...form, batch_unit: e.target.value })} placeholder={lang === 'ar' ? 'صينية، دفعة، وجبة' : 'tray, batch'} />
                </div>
                <div style={{ textAlign: 'center', paddingBottom: 8, fontSize: 13, color: '#888' }}>
                  {lang === 'ar' ? 'تنتج' : 'produces'}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'الكمية' : 'Qty'}</div>
                  <input type="number" value={form.units_per_batch} min={1} onChange={e => setForm({ ...form, units_per_batch: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{lang === 'ar' ? 'وحدة المنتج' : 'Output unit'}</div>
                  <input type="text" value={form.output_unit} onChange={e => setForm({ ...form, output_unit: e.target.value })} placeholder={lang === 'ar' ? 'حبة، قطعة، رغيف' : 'piece, loaf'} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 8 }}>
                {lang === 'ar'
                  ? `كل ${form.batch_unit} تنتج ${form.units_per_batch} ${form.output_unit}`
                  : `Each ${form.batch_unit} produces ${form.units_per_batch} ${form.output_unit}`}
              </div>
            </div>

            {/* Sell price */}
            <div style={{ marginBottom: 12, maxWidth: 200 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                {lang === 'ar' ? `سعر البيع (للـ${form.output_unit})` : `Sell price (per ${form.output_unit})`}
              </div>
              <input
                type="number"
                value={form.sell_price}
                min={0}
                step={0.5}
                onChange={e => setForm({ ...form, sell_price: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Ingredients */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>
                  {lang === 'ar' ? `مكونات الـ${form.batch_unit}` : `Ingredients per ${form.batch_unit}`}
                </div>
                <button onClick={addIng} className="btn" style={{ fontSize: 11, padding: '4px 10px' }}>+ {lang === 'ar' ? 'مكون' : 'ingredient'}</button>
              </div>
              {form.ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 30px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <select value={ing.material} onChange={e => updateIng(i, 'material', e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid #d4d4d4', fontSize: 13, background: '#fff' }}>
                    <option value="">{lang === 'ar' ? '-- اختر المادة --' : '-- Select --'}</option>
                    {stock.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.unit})</option>
                    ))}
                  </select>
                  <input type="number" value={ing.amount} min={0} step={0.01} onChange={e => updateIng(i, 'amount', e.target.value)} placeholder={lang === 'ar' ? 'الكمية' : 'Amount'} />
                  {form.ingredients.length > 1 && (
                    <button onClick={() => removeIng(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 16 }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={save} disabled={saving}>
              {saving ? '...' : (editing ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save') : (lang === 'ar' ? 'إضافة الوصفة' : 'Add Recipe'))}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="tbl" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 700 }}>
            <div className="thead" style={{ gridTemplateColumns: COLS, gap: 8 }}>
              <span>{lang === 'ar' ? 'الوصفة' : 'Recipe'}</span>
              <span>{lang === 'ar' ? 'الإنتاج' : 'Output'}</span>
              <span>{lang === 'ar' ? 'سعر البيع' : 'Sell Price'}</span>
              <span>{lang === 'ar' ? 'كوست الدفعة' : 'Batch Cost'}</span>
              <span>{lang === 'ar' ? 'كوست الحبة' : 'Unit Cost'}</span>
              <span>{lang === 'ar' ? 'هامش' : 'Margin'}</span>
              <span></span>
            </div>
            {recipes.length === 0 ? (
              <div className="tbl-empty">
                {lang === 'ar' ? 'لا توجد وصفات. اضغط "+ وصفة جديدة".' : 'No recipes. Click "+ New Recipe".'}
              </div>
            ) : recipes.map(r => {
              const bc = getBatchCost(r)
              const uc = getUnitCost(r)
              const sp = r.sell_price || 0
              const margin = sp > 0 ? ((sp - uc) / sp * 100) : null
              const mc = margin === null ? '#9ca3af' : margin < 0 ? '#dc2626' : margin < 15 ? '#d97706' : '#059669'
              const batchUnit = r.batch_unit || r.output_unit
              const unitsPerBatch = r.units_per_batch || r.output_qty
              return (
                <div key={r.id} className="trow" style={{ gridTemplateColumns: COLS, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{(r.ingredients || []).length} {lang === 'ar' ? 'مكون' : 'ingredients'}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b7280' }}>{batchUnit} <span style={{ color: '#d1d5db' }}>→</span> <span className="num">{unitsPerBatch}</span> {r.output_unit}</div>
                  <span className="num">{sp > 0 ? sp.toFixed(2) : '—'}</span>
                  <span className="num" style={{ color: '#6b7280' }}>{bc.toFixed(2)}</span>
                  <span className="num" style={{ color: '#6b7280' }}>{uc.toFixed(3)}</span>
                  <span className="num" style={{ color: mc, fontWeight: 600 }}>{margin !== null ? margin.toFixed(0) + '%' : '—'}</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="ibtn ibtn-edit" onClick={() => startEdit(r)} title={lang === 'ar' ? 'تعديل' : 'Edit'}><EditIcon /></button>
                    <button className="ibtn ibtn-del" onClick={() => deleteRecipe(r.id)} title={lang === 'ar' ? 'حذف' : 'Delete'}><TrashIcon /></button>
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
  if (!user.perms?.produce) return { redirect: { destination: '/403', permanent: false } }
  const bakery_id = user.bakery_id
  const [{ data: recipes }, { data: stock }] = await Promise.all([
    bakery_id
      ? supabaseAdmin.from('recipes').select('*').eq('bakery_id', bakery_id).order('name')
      : supabaseAdmin.from('recipes').select('*').order('name'),
    bakery_id
      ? supabaseAdmin.from('stock').select('*').eq('bakery_id', bakery_id).order('name')
      : supabaseAdmin.from('stock').select('*').order('name'),
  ])
  return { props: { user, initialRecipes: recipes || [], initialStock: stock || [] } }
}
