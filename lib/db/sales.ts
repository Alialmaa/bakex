import { supabaseAdmin } from '../supabase'

export async function listSales(bakery_id: string | null, from?: string, to?: string) {
  let query = supabaseAdmin.from('sales').select('*').order('created_at', { ascending: false })
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return data
}

export interface SaleEntry {
  recipe_id: string
  recipe_name?: string
  qty: number
  unit_price: number
}

export async function createSales(bakery_id: string, entries: SaleEntry[], sold_by: string, date?: string) {
  const created_at = date
    ? new Date(date + 'T12:00:00').toISOString()
    : new Date().toISOString()

  // Each column is set explicitly. This used to spread the caller's object
  // (`{ ...e }`), which handed the client a direct write into every column of
  // the table — including `total`, the figure every financial report sums.
  const rows = entries.map(e => ({
    recipe_id: e.recipe_id,
    recipe_name: typeof e.recipe_name === 'string' ? e.recipe_name.slice(0, 200) : null,
    qty: e.qty,
    unit_price: e.unit_price,
    total: Math.round(e.qty * e.unit_price * 100) / 100,
    bakery_id,
    sold_by,
    created_at,
  }))

  const { data, error } = await supabaseAdmin
    .from('sales')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

export async function deleteSale(id: string, bakery_id: string) {
  const { error } = await supabaseAdmin
    .from('sales')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}

export async function getSalesInRange(bakery_id: string, from: string, to?: string) {
  return listSales(bakery_id, from, to)
}

export async function getWeeklySales(bakery_id: string | null): Promise<{ day: string; total: number }[]> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const from = days[0]
  const sales = await getSalesInRange(bakery_id, from)
  const map: Record<string, number> = {}
  for (const s of sales || []) {
    const day = (s.created_at as string).split('T')[0]
    map[day] = (map[day] || 0) + s.total
  }
  return days.map(d => ({ day: d, total: map[d] || 0 }))
}
