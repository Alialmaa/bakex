import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

const MAX_BATCHES = 100_000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  if (!user.perms?.produce) return res.status(403).json({ error: 'Forbidden' })

  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { recipe_id, batches = 1 } = req.body
  if (!recipe_id || typeof recipe_id !== 'string') return res.status(400).json({ error: 'recipe_id is required' })
  if (typeof batches !== 'number' || !Number.isFinite(batches) || batches < 1 || batches > MAX_BATCHES
      || !Number.isInteger(batches)) {
    return res.status(400).json({ error: 'batches must be a whole number of at least 1' })
  }

  // Fetch recipe scoped to this bakery
  const { data: recipe } = await supabaseAdmin
    .from('recipes').select('*').eq('id', recipe_id).eq('bakery_id', bakery_id).single()
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  // Rows written before ingredient validation existed may still hold a
  // non-numeric amount. `qty < NaN` is false, so such a row would sail through
  // the stock check below and then write NaN into the quantity.
  const ingredients: { material: string; amount: number }[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  for (const ing of ingredients) {
    if (typeof ing?.amount !== 'number' || !Number.isFinite(ing.amount) || ing.amount <= 0 || typeof ing?.material !== 'string') {
      return res.status(400).json({ error: 'This recipe has an invalid ingredient — edit it before producing' })
    }
  }

  // Check stock for all batches — scoped to this bakery
  for (const ing of ingredients) {
    const { data: mat } = await supabaseAdmin
      .from('stock').select('*').eq('name', ing.material).eq('bakery_id', bakery_id).single()
    const needed = ing.amount * batches
    if (!mat || typeof mat.qty !== 'number' || !(mat.qty >= needed)) {
      return res.status(400).json({ error: `Insufficient: ${ing.material}` })
    }
  }

  // Deduct stock — scoped to this bakery
  for (const ing of ingredients) {
    const { data: mat } = await supabaseAdmin
      .from('stock').select('qty').eq('name', ing.material).eq('bakery_id', bakery_id).single()
    const needed = ing.amount * batches
    await supabaseAdmin
      .from('stock').update({ qty: Math.max(0, mat!.qty - needed) })
      .eq('name', ing.material).eq('bakery_id', bakery_id)
  }

  // Log production with bakery_id
  const totalUnits = (recipe.units_per_batch || recipe.output_qty) * batches
  await supabaseAdmin.from('production_log').insert({
    recipe_id, recipe_name: recipe.name,
    output_qty: totalUnits, output_unit: recipe.output_unit,
    produced_by: user.id, bakery_id,
  })

  // Add finished goods to stock
  const { data: existingFinished } = await supabaseAdmin
    .from('stock')
    .select('id, qty')
    .eq('name', recipe.name)
    .eq('bakery_id', bakery_id)
    .maybeSingle()

  if (existingFinished) {
    await supabaseAdmin
      .from('stock')
      .update({ qty: (existingFinished.qty || 0) + totalUnits })
      .eq('id', existingFinished.id)
  } else {
    await supabaseAdmin
      .from('stock')
      .insert({
        bakery_id,
        name: recipe.name,
        qty: totalUnits,
        unit: recipe.output_unit || 'حبة',
      })
  }

  res.status(200).json({ success: true, totalUnits })
}
