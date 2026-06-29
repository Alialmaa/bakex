import { supabaseAdmin } from '../supabase'

export async function listRecipes(bakery_id: string | null) {
  let query = supabaseAdmin.from('recipes').select('*').order('name')
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getRecipe(id: string, bakery_id: string) {
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('bakery_id', bakery_id)
    .single()
  if (error) throw error
  return data
}

export async function createRecipe(bakery_id: string, recipe: {
  name: string; batch_unit?: string; units_per_batch?: number
  output_qty?: number; output_unit?: string; sell_price?: number; ingredients?: any[]
}) {
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .insert({
      bakery_id,
      name: recipe.name,
      batch_unit: recipe.batch_unit || recipe.output_unit || 'حبة',
      units_per_batch: recipe.units_per_batch || recipe.output_qty || 1,
      output_qty: recipe.units_per_batch || recipe.output_qty || 1,
      output_unit: recipe.output_unit || 'حبة',
      sell_price: recipe.sell_price || 0,
      ingredients: recipe.ingredients || [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRecipe(id: string, bakery_id: string, recipe: Partial<{
  name: string; batch_unit: string; units_per_batch: number
  output_qty: number; output_unit: string; sell_price: number; ingredients: any[]
}>) {
  const update: any = {}
  if (recipe.name !== undefined) update.name = recipe.name
  if (recipe.batch_unit !== undefined) update.batch_unit = recipe.batch_unit
  if (recipe.units_per_batch !== undefined) { update.units_per_batch = recipe.units_per_batch; update.output_qty = recipe.units_per_batch }
  if (recipe.output_qty !== undefined) update.output_qty = recipe.output_qty
  if (recipe.output_unit !== undefined) update.output_unit = recipe.output_unit
  if (recipe.sell_price !== undefined) update.sell_price = recipe.sell_price
  if (recipe.ingredients !== undefined) update.ingredients = recipe.ingredients
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .update(update)
    .eq('id', id)
    .eq('bakery_id', bakery_id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRecipe(id: string, bakery_id: string) {
  const { error } = await supabaseAdmin
    .from('recipes')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}
