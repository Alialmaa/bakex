import { supabaseAdmin } from '../supabase'
import { adjustStockQty } from './stock'

export async function listPurchases(bakery_id: string | null) {
  let query = supabaseAdmin.from('purchases').select('*').order('created_at', { ascending: false }).limit(100)
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPurchase(bakery_id: string, created_by: string, purchase: {
  material_name: string; qty: number; unit: string
  pack_weight?: number; pack_price?: number; price_per_unit: number; notes?: string
}) {
  const { data, error } = await supabaseAdmin
    .from('purchases')
    .insert({ ...purchase, bakery_id, created_by })
    .select()
    .single()
  if (error) throw error

  await adjustStockQty(purchase.material_name, bakery_id, purchase.qty, purchase.price_per_unit)

  return data
}

export async function deletePurchase(id: string, bakery_id: string) {
  const { error } = await supabaseAdmin
    .from('purchases')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}

export async function getPurchaseCostInRange(bakery_id: string | null, from: string, to?: string) {
  let query = supabaseAdmin.from('purchases').select('qty, price_per_unit').gte('created_at', from)
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  if (to) query = query.lte('created_at', to)
  const { data } = await query
  return (data || []).reduce((s: number, p: any) => s + p.qty * p.price_per_unit, 0)
}
