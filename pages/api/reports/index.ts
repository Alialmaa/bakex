import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listSales, getWeeklySales } from '../../../lib/db/sales'
import { listRecipes } from '../../../lib/db/recipes'
import { listStock } from '../../../lib/db/stock'
import { listProduction } from '../../../lib/db/production'
import { getPurchaseCostInRange } from '../../../lib/db/purchases'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const prevMonthStart = getPrevMonthStart()
    const prevMonthEnd = monthStart

    const [sales, recipes, stock, prodLog, weeklySales, monthPurchaseCost, prevSales, prevPurchaseCost] = await Promise.all([
      listSales(bakery_id, monthStart),
      listRecipes(bakery_id),
      listStock(bakery_id),
      listProduction(bakery_id),
      getWeeklySales(bakery_id),
      getPurchaseCostInRange(bakery_id, monthStart),
      listSales(bakery_id, prevMonthStart, prevMonthEnd),
      getPurchaseCostInRange(bakery_id, prevMonthStart, prevMonthEnd),
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

    // Per-product breakdown
    const data = (recipes || []).map((r: any) => {
      const rSales = (sales || []).filter((s: any) => s.recipe_id === r.id)
      const qty = rSales.reduce((s: number, l: any) => s + l.qty, 0)
      const revenue = rSales.reduce((s: number, l: any) => s + l.total, 0)
      const unitCost = getUnitCost(r)
      const cost = unitCost * qty
      const profit = revenue - cost
      const margin = revenue > 0 ? (profit / revenue) * 100 : null
      return { name: r.name, qty, revenue, cost, profit, margin, unitCost, sellPrice: r.sell_price || 0 }
    }).filter((d: any) => d.qty > 0 || d.revenue > 0)

    // Production summary
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

    const monthRev = (sales || []).reduce((s: number, r: any) => s + r.total, 0)
    const prevRev = (prevSales || []).reduce((s: number, r: any) => s + r.total, 0)

    // Real profit = revenue - actual purchase cost this month
    const monthProfit = monthRev - monthPurchaseCost
    const prevProfit = prevRev - prevPurchaseCost

    const totals = {
      revenue: monthRev,
      cost: monthPurchaseCost,
      profit: monthProfit,
      avgMargin: monthRev > 0 ? (monthProfit / monthRev) * 100 : 0,
    }

    res.status(200).json({
      data,
      totals,
      prodSummary: Object.values(prodMap),
      weeklySales,
      comparison: {
        thisMonth: { revenue: monthRev, profit: monthProfit },
        lastMonth: { revenue: prevRev, profit: prevProfit },
      },
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}

function getPrevMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7) + '-01'
}
