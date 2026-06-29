import { supabaseAdmin } from '../supabase'

export async function listProduction(bakery_id: string | null, date?: string) {
  let query = supabaseAdmin.from('production_log').select('*').order('created_at', { ascending: false })
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function updateProductionEntry(id: string, bakery_id: string, output_qty: number) {
  const { error } = await supabaseAdmin
    .from('production_log')
    .update({ output_qty })
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}

export async function deleteProductionEntry(id: string, bakery_id: string) {
  const { error } = await supabaseAdmin
    .from('production_log')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}
