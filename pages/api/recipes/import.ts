import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listRecipes, createRecipe, updateRecipe } from '../../../lib/db/recipes'
import { requireIngredients, normaliseIngredients } from '../../../lib/validate'
import { apiError } from '../../../lib/apiError'
import { logAudit } from '../../../lib/audit'
import { MAX_IMPORT_RECIPES } from '../../../lib/importRecipes'

/**
 * Bulk import of recipes.
 *
 * The browser grouped the sheet's rows into recipes and showed the user a
 * preview; none of that is evidence. Every recipe is validated here with the
 * same `requireIngredients` the single-recipe route uses, and goes through
 * createRecipe / updateRecipe rather than a raw insert, so a recipe made this
 * way is identical to one typed in by hand.
 *
 * Matched by name, like the materials import. `update` overwrites the
 * ingredients and the batch figures; `skip` adds only what is new. Nothing is
 * deleted — a recipe missing from the file is left alone.
 */

const MAX_UNITS_PER_BATCH = 1_000_000
const MAX_PRICE = 1_000_000

interface CleanRecipe {
  name: string
  units_per_batch: number
  output_unit: string
  sell_price: number
  ingredients: { material: string; amount: number }[]
}

const bounded = (v: unknown, max: number, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, max)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })
  // Recipes are costed from stock prices, so editing them is the stock
  // permission — the same one the single-recipe route requires.
  if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })

  const body: any = req.body ?? {}
  const mode: 'update' | 'skip' = body.mode === 'skip' ? 'skip' : 'update'

  if (!Array.isArray(body.recipes)) return res.status(400).json({ error: 'recipes must be an array' })
  if (body.recipes.length === 0) return res.status(400).json({ error: 'nothing to import' })
  if (body.recipes.length > MAX_IMPORT_RECIPES) {
    return res.status(400).json({ error: `too many recipes (max ${MAX_IMPORT_RECIPES})` })
  }

  const byName = new Map<string, CleanRecipe>()
  for (const raw of body.recipes) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 200) : ''
    if (!name) continue

    const ingredients = normaliseIngredients(raw?.ingredients)
    // The same validator the hand-typed path uses. A non-numeric amount used to
    // reach the produce endpoint, where the stock check compared against NaN —
    // always false — and then wrote NaN into the quantity.
    const err = requireIngredients(ingredients)
    if (err) return res.status(400).json({ error: `${name}: ${err}` })
    if (ingredients.length === 0) continue

    byName.set(name, {
      name,
      units_per_batch: bounded(raw?.units_per_batch, MAX_UNITS_PER_BATCH, 1) || 1,
      output_unit: typeof raw?.output_unit === 'string' ? raw.output_unit.trim().slice(0, 50) || 'حبة' : 'حبة',
      sell_price: bounded(raw?.sell_price, MAX_PRICE),
      ingredients,
    })
  }

  const recipes = Array.from(byName.values())
  if (recipes.length === 0) return res.status(400).json({ error: 'no recipe had a name and ingredients' })

  try {
    const existing = await listRecipes(bakery_id)
    const existingByName = new Map<string, any>((existing || []).map((r: any) => [r.name, r]))

    let added = 0, updated = 0, skipped = 0

    for (const r of recipes) {
      const found = existingByName.get(r.name)
      if (found) {
        if (mode === 'skip') { skipped++; continue }
        await updateRecipe(found.id, bakery_id, {
          units_per_batch: r.units_per_batch,
          output_unit: r.output_unit,
          batch_unit: r.output_unit,
          sell_price: r.sell_price,
          ingredients: r.ingredients,
        })
        updated++
      } else {
        await createRecipe(bakery_id, {
          name: r.name,
          units_per_batch: r.units_per_batch,
          output_unit: r.output_unit,
          sell_price: r.sell_price,
          ingredients: r.ingredients,
        })
        added++
      }
    }

    await logAudit({
      bakery_id,
      actor_id: user.id,
      actor_name: user.name,
      action: 'recipes.import',
      target_type: 'recipe',
      details: { mode, added, updated, skipped },
    })

    return res.status(200).json({ added, updated, skipped, total: recipes.length })
  } catch (e) {
    return apiError(res, e, 'recipes.import')
  }
}
