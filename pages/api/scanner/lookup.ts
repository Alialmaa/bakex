import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { barcode, mode } = req.query
  if (typeof barcode !== 'string' || !barcode.trim())
    return res.status(400).json({ error: 'barcode is required' })

  const bid = user.bakery_id

  if (mode === 'stock' || !mode) {
    const { data } = await supabaseAdmin
      .from('stock')
      .select('id, name, qty, unit, min_qty, price_per_unit, barcode')
      .eq('bakery_id', bid)
      .eq('barcode', barcode.trim())
      .single()

    if (data) return res.status(200).json({ found: true, type: 'stock', data })
  }

  if (mode === 'recipe' || !mode) {
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id, name, ingredients, units_per_batch, output_qty, output_unit, sell_price, barcode')
      .eq('bakery_id', bid)
      .eq('barcode', barcode.trim())
      .single()

    if (recipe) {
      // Calculate unit cost from current stock prices
      const { data: stock } = await supabaseAdmin
        .from('stock')
        .select('name, price_per_unit')
        .eq('bakery_id', bid)

      const priceMap: Record<string, number> = {}
      for (const s of stock || []) priceMap[s.name] = s.price_per_unit || 0

      const totalCost = (recipe.ingredients || []).reduce(
        (sum: number, ing: any) => sum + ing.amount * (priceMap[ing.material] || 0), 0
      )
      const units = recipe.units_per_batch || recipe.output_qty || 1
      const unit_cost = units > 0 ? totalCost / units : 0

      return res.status(200).json({ found: true, type: 'recipe', data: { ...recipe, unit_cost } })
    }
  }

  return res.status(200).json({ found: false })
}
