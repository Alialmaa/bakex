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

  // One call does the whole sequence inside a single transaction. Checking
  // every ingredient and then deducting in a second pass meant two requests
  // arriving together both passed the check and both deducted, producing twice
  // the goods from one set of materials.
  const { data, error } = await supabaseAdmin.rpc('produce_recipe', {
    p_bakery_id: bakery_id,
    p_recipe_id: recipe_id,
    p_batches: batches,
    p_user_id: user.id,
  })

  if (error) {
    const m = /insufficient:(.*)$/.exec(error.message || '')
    if (m) return res.status(400).json({ error: `Insufficient: ${m[1].trim()}` })
    if ((error.message || '').includes('invalid_ingredient')) {
      return res.status(400).json({ error: 'This recipe has an invalid ingredient — edit it before producing' })
    }
    console.error('produce_recipe failed:', error)
    return res.status(500).json({ error: 'Could not record production' })
  }

  const row = Array.isArray(data) ? data[0] : data
  if (row?.shortage === 'recipe_not_found') return res.status(404).json({ error: 'Recipe not found' })
  if (row?.shortage) return res.status(400).json({ error: row.shortage })

  const totalUnits = Number(row?.total_units ?? 0)

  res.status(200).json({ success: true, totalUnits })
}
