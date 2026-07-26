import { supabaseAdmin } from '../supabase'

/**
 * Production entries for display.
 *
 * This had no limit and no default date bound, so callers that passed neither
 * pulled the bakery's entire production history on every page load.
 */
export async function listProduction(bakery_id: string | null, date?: string, limit = 500) {
  let query = supabaseAdmin.from('production_log').select('*').order('created_at', { ascending: false }).limit(limit)
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

/** Output per recipe for a period, grouped in Postgres. */
export async function getProductionByRecipe(
  bakery_id: string, from: string, to?: string
): Promise<{ recipe_id: string; recipe_name: string; output_unit: string; total: number }[]> {
  const { data, error } = await supabaseAdmin.rpc('production_by_recipe', {
    p_bakery_id: bakery_id, p_from: from, p_to: to ?? null,
  })
  if (error) throw error
  return ((data as any[]) || []).map(r => ({
    recipe_id: r.recipe_id,
    recipe_name: r.recipe_name,
    output_unit: r.output_unit,
    total: Number(r.total) || 0,
  }))
}
