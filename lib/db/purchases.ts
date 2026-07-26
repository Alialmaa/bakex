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
    // Named explicitly rather than spread. The caller happens to build this
    // object from validated fields today, but the same spread in createSales
    // was a direct write into every column of the table.
    .insert({
      material_name: purchase.material_name,
      qty: purchase.qty,
      unit: purchase.unit,
      pack_weight: purchase.pack_weight ?? null,
      pack_price: purchase.pack_price ?? null,
      price_per_unit: purchase.price_per_unit,
      notes: purchase.notes ?? null,
      bakery_id,
      created_by,
    })
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

/**
 * Total spend for a period, summed in Postgres.
 *
 * Previously fetched qty and price_per_unit for every purchase row in the range
 * and multiplied them in JS.
 */
export async function getPurchaseCostInRange(bakery_id: string | null, from: string, to?: string) {
  if (!bakery_id) return 0
  const { data, error } = await supabaseAdmin.rpc('purchase_cost', {
    p_bakery_id: bakery_id, p_from: from, p_to: to ?? null,
  })
  if (error) throw error
  return Number(data) || 0
}
