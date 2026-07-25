import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listRecipes, createRecipe, updateRecipe, deleteRecipe } from '../../../lib/db/recipes'
import { requireString, requireNonNegativeNumber, requireIngredients, normaliseIngredients } from '../../../lib/validate'

const MAX_UNITS_PER_BATCH = 1_000_000
const MAX_PRICE = 1_000_000

function validateRecipeFields(body: any, opts: { nameRequired: boolean }): string | null {
  const { name, batch_unit, output_unit, units_per_batch, output_qty, sell_price, ingredients } = body

  if (opts.nameRequired || name !== undefined) {
    const err = requireString(name, 'name', { max: 200 })
    if (err) return err
  }
  for (const [value, field] of [[batch_unit, 'batch_unit'], [output_unit, 'output_unit']] as const) {
    if (value !== undefined) {
      const err = requireString(value, field, { max: 50 })
      if (err) return err
    }
  }
  for (const [value, field, max] of [
    [units_per_batch, 'units_per_batch', MAX_UNITS_PER_BATCH],
    [output_qty, 'output_qty', MAX_UNITS_PER_BATCH],
    [sell_price, 'sell_price', MAX_PRICE],
  ] as const) {
    const err = requireNonNegativeNumber(value, field)
    if (err) return err
    if (typeof value === 'number' && value > max) return `${field} is out of range`
  }
  return requireIngredients(ingredients)
}

/** Only the recipe's own fields, with ingredients reduced to material + amount. */
function cleanRecipe(body: any) {
  const out: any = {}
  for (const k of ['name', 'batch_unit', 'output_unit', 'units_per_batch', 'output_qty', 'sell_price']) {
    if (body[k] !== undefined) out[k] = typeof body[k] === 'string' ? body[k].trim() : body[k]
  }
  if (body.ingredients !== undefined) out.ingredients = normaliseIngredients(body.ingredients)
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listRecipes(bakery_id))
    }
    if (req.method === 'POST') {
      if (!user.perms?.produce && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const err = validateRecipeFields(req.body, { nameRequired: true })
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await createRecipe(bakery_id, cleanRecipe(req.body)))
    }
    if (req.method === 'PUT') {
      if (!user.perms?.produce && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { id } = req.body
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' })
      // PUT accepted whatever the client sent and wrote it through unchecked,
      // so a negative sell_price or a malformed ingredient list only had to
      // avoid the create path to get in.
      const err = validateRecipeFields(req.body, { nameRequired: false })
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await updateRecipe(id, bakery_id, cleanRecipe(req.body)))
    }
    if (req.method === 'DELETE') {
      if (!user.perms?.produce && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      await deleteRecipe(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
