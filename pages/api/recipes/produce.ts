import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const { recipe_id } = req.body
  const { data: recipe } = await supabaseAdmin.from('recipes').select('*').eq('id', recipe_id).single()
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  // Check stock & deduct
  for (const ing of recipe.ingredients) {
    const { data: mat } = await supabaseAdmin.from('stock').select('*').eq('name', ing.material).single()
    if (!mat || mat.qty < ing.amount) return res.status(400).json({ error: `Insufficient: ${ing.material}` })
  }

  for (const ing of recipe.ingredients) {
    const { data: mat } = await supabaseAdmin.from('stock').select('qty').eq('name', ing.material).single()
    await supabaseAdmin.from('stock').update({ qty: Math.max(0, mat!.qty - ing.amount) }).eq('name', ing.material)
  }

  // Log production
  await supabaseAdmin.from('production_log').insert({
    recipe_id, recipe_name: recipe.name, output_qty: recipe.output_qty, output_unit: recipe.output_unit, produced_by: user.id
  })

  res.status(200).json({ success: true })
}
