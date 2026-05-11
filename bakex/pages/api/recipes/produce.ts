import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const { recipe_id, batches = 1 } = req.body
  const { data: recipe } = await supabaseAdmin.from('recipes').select('*').eq('id', recipe_id).single()
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  // Check stock for all batches
  for (const ing of recipe.ingredients) {
    const { data: mat } = await supabaseAdmin.from('stock').select('*').eq('name', ing.material).single()
    const needed = ing.amount * batches
    if (!mat || mat.qty < needed) return res.status(400).json({ error: `Insufficient: ${ing.material}` })
  }

  // Deduct stock
  for (const ing of recipe.ingredients) {
    const { data: mat } = await supabaseAdmin.from('stock').select('qty').eq('name', ing.material).single()
    const needed = ing.amount * batches
    await supabaseAdmin.from('stock').update({ qty: Math.max(0, mat!.qty - needed) }).eq('name', ing.material)
  }

  // Log production - one row per batch * output_qty (total units)
  const totalUnits = recipe.output_qty * batches
  await supabaseAdmin.from('production_log').insert({
    recipe_id, recipe_name: recipe.name,
    output_qty: totalUnits, output_unit: recipe.output_unit,
    produced_by: user.id
  })

  res.status(200).json({ success: true, totalUnits })
}
