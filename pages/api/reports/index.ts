import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'
  const [{ data: sales }, { data: recipes }, { data: stock }, { data: prodLog }] = await Promise.all([
    supabaseAdmin.from('sales').select('*').gte('created_at', monthStart),
    supabaseAdmin.from('recipes').select('*'),
    supabaseAdmin.from('stock').select('*'),
    supabaseAdmin.from('production_log').select('*').gte('created_at', monthStart),
  ])

  const getStk = (name: string) => (stock || []).find((s: any) => s.name === name)
  const getUnitCost = (recipe: any) => {
    const total = (recipe.ingredients || []).reduce((s: number, ing: any) => {
      const m = getStk(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    const units = recipe.units_per_batch || recipe.output_qty || 1
    return units > 0 ? total / units : 0
  }

  const data = (recipes || []).map((r: any) => {
    const rSales = (sales || []).filter((s: any) => s.recipe_id === r.id)
    const qty = rSales.reduce((s: number, l: any) => s + l.qty, 0)
    const revenue = rSales.reduce((s: number, l: any) => s + l.total, 0)
    const unitCost = getUnitCost(r)
    const cost = unitCost * qty
    const profit = revenue - cost
    const margin = revenue > 0 ? (profit / revenue) * 100 : null
    return { name: r.name, qty, revenue, cost, profit, margin, unitCost, sellPrice: r.sell_price || 0 }
  })

  const prodMap: Record<string, any> = {}
  for (const l of (prodLog || [])) {
    if (!prodMap[l.recipe_id]) {
      const recipe = (recipes || []).find((r: any) => r.id === l.recipe_id)
      const unitCost = recipe ? getUnitCost(recipe) : 0
      prodMap[l.recipe_id] = { recipe_name: l.recipe_name, output_unit: l.output_unit, total: 0, unitCost, totalCost: 0 }
    }
    prodMap[l.recipe_id].total += l.output_qty
    prodMap[l.recipe_id].totalCost += l.output_qty * prodMap[l.recipe_id].unitCost
  }

  const totals = {
    revenue: data.reduce((s: number, d: any) => s + d.revenue, 0),
    cost: data.reduce((s: number, d: any) => s + d.cost, 0),
    profit: data.reduce((s: number, d: any) => s + d.profit, 0),
    avgMargin: 0,
  }
  totals.avgMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0

  res.status(200).json({ data, totals, prodSummary: Object.values(prodMap) })
}
