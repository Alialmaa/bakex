import { supabaseAdmin } from '../supabase'

export async function listStock(bakery_id: string | null) {
  let query = supabaseAdmin.from('stock').select('*').order('name')
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function addStockItem(bakery_id: string | null, item: {
  name: string; qty: number; unit: string; min_qty: number; price_per_unit: number
}) {
  const { data, error } = await supabaseAdmin
    .from('stock')
    .insert({ ...item, bakery_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStockItem(id: string, bakery_id: string | null, update: {
  qty?: number; min_qty?: number; price_per_unit?: number
}) {
  let q = supabaseAdmin.from('stock').update(update).eq('id', id)
  if (bakery_id) q = q.eq('bakery_id', bakery_id)
  const { data, error } = await q
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStockItem(id: string, bakery_id: string | null) {
  let q = supabaseAdmin.from('stock').delete().eq('id', id)
  if (bakery_id) q = q.eq('bakery_id', bakery_id)
  const { error } = await q
  if (error) throw error
}

export async function getStockByName(name: string, bakery_id: string | null) {
  let q = supabaseAdmin.from('stock').select('*').eq('name', name)
  if (bakery_id) q = q.eq('bakery_id', bakery_id)
  const { data } = await q.single()
  return data
}

export async function adjustStockQty(name: string, bakery_id: string, delta: number, newPrice?: number) {
  // Done in one statement. Reading the quantity and writing back qty + delta
  // meant two purchases recorded at the same moment both read the old value,
  // and one of the increments was silently lost.
  const { error } = await supabaseAdmin.rpc('adjust_stock_qty', {
    p_bakery_id: bakery_id,
    p_name: name,
    p_delta: delta,
    p_new_price: newPrice ?? null,
  })
  if (error) throw error
}
