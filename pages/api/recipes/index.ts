import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listRecipes, createRecipe, updateRecipe, deleteRecipe } from '../../../lib/db/recipes'
import { requireString, requireNonNegativeNumber } from '../../../lib/validate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listRecipes(bakery_id))
    }
    if (req.method === 'POST') {
      const { name, units_per_batch, output_qty, sell_price, ingredients } = req.body
      const err = requireString(name, 'name')
        || requireNonNegativeNumber(units_per_batch, 'units_per_batch')
        || requireNonNegativeNumber(output_qty, 'output_qty')
        || requireNonNegativeNumber(sell_price, 'sell_price')
        || (ingredients !== undefined && !Array.isArray(ingredients) ? 'ingredients must be an array' : null)
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await createRecipe(bakery_id, req.body))
    }
    if (req.method === 'PUT') {
      const { id, ...rest } = req.body
      return res.status(200).json(await updateRecipe(id, bakery_id, rest))
    }
    if (req.method === 'DELETE') {
      await deleteRecipe(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
