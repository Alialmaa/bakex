import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { getWeeklySales, getSalesRevenue, getSalesByRecipe } from '../../../lib/db/sales'
import { listRecipes } from '../../../lib/db/recipes'
import { listStock } from '../../../lib/db/stock'
import { getProductionByRecipe } from '../../../lib/db/production'
import { getPurchaseCostInRange } from '../../../lib/db/purchases'
import { apiError } from '../../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })
  if (!user.perms?.reports && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })

  try {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const prevMonthStart = getPrevMonthStart()
    const prevMonthEnd = monthStart

    // recipes and stock are still fetched in full: they are small, and unit cost
    // is business logic worth keeping readable in one place. Everything else is
    // now an aggregate, so the row-heavy tables stay in the database — this used
    // to pull every sale for two months plus the entire production history, on
    // every call, and the page calls it every 30 seconds.
    const [recipes, stock, salesByRecipe, prodByRecipe, weeklySales,
           monthRev, monthPurchaseCost, prevRev, prevPurchaseCost] = await Promise.all([
      listRecipes(bakery_id),
      listStock(bakery_id),
      getSalesByRecipe(bakery_id, monthStart),
      getProductionByRecipe(bakery_id, monthStart),
      getWeeklySales(bakery_id),
      getSalesRevenue(bakery_id, monthStart),
      getPurchaseCostInRange(bakery_id, monthStart),
      getSalesRevenue(bakery_id, prevMonthStart, prevMonthEnd),
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
      const agg = salesByRecipe.get(r.id)
      const qty = agg?.qty ?? 0
      const revenue = agg?.revenue ?? 0
      const unitCost = getUnitCost(r)
      const cost = unitCost * qty
      const profit = revenue - cost
      const margin = revenue > 0 ? (profit / revenue) * 100 : null
      return { name: r.name, qty, revenue, cost, profit, margin, unitCost, sellPrice: r.sell_price || 0 }
    }).filter((d: any) => d.qty > 0 || d.revenue > 0)

    // Production summary
    const prodSummary = prodByRecipe.map(p => {
      const recipe = (recipes || []).find((r: any) => r.id === p.recipe_id)
      const unitCost = recipe ? getUnitCost(recipe) : 0
      return {
        recipe_name: p.recipe_name,
        output_unit: p.output_unit,
        total: p.total,
        unitCost,
        totalCost: p.total * unitCost,
      }
    })

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
      prodSummary,
      weeklySales,
      comparison: {
        thisMonth: { revenue: monthRev, profit: monthProfit },
        lastMonth: { revenue: prevRev, profit: prevProfit },
      },
    })
  } catch (e) {
    return apiError(res, e, 'reports')
  }
}

function getPrevMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7) + '-01'
}
