import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  if (!user.perms?.produce) return res.status(403).json({ error: 'Forbidden' })

  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { recipe_id, batches = 1 } = req.body
  if (!recipe_id || typeof recipe_id !== 'string') return res.status(400).json({ error: 'recipe_id is required' })
  if (typeof batches !== 'number' || batches < 1 || !Number.isFinite(batches)) {
    return res.status(400).json({ error: 'batches must be a positive number' })
  }

  // Fetch recipe scoped to this bakery
  const { data: recipe } = await supabaseAdmin
    .from('recipes').select('*').eq('id', recipe_id).eq('bakery_id', bakery_id).single()
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  // Check stock for all batches — scoped to this bakery
  for (const ing of recipe.ingredients) {
    const { data: mat } = await supabaseAdmin
      .from('stock').select('*').eq('name', ing.material).eq('bakery_id', bakery_id).single()
    const needed = ing.amount * batches
    if (!mat || mat.qty < needed) return res.status(400).json({ error: `Insufficient: ${ing.material}` })
  }

  // Deduct stock — scoped to this bakery
  for (const ing of recipe.ingredients) {
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

  res.status(200).json({ success: true, totalUnits })
}
