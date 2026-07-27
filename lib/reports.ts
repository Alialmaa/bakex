import { getWeeklySales, getSalesRevenue, getSalesByRecipe } from './db/sales'
import { listRecipes } from './db/recipes'
import { listStock } from './db/stock'
import { getProductionByRecipe } from './db/production'
import { getPurchaseCostInRange } from './db/purchases'

/**
 * The reports payload, built in exactly one place.
 *
 * `pages/reports.tsx` (getServerSideProps) and `/api/reports` both render the
 * same four metric cards, and each used to compute them its own way: the page
 * summed recipe cost × quantity sold, the API summed the purchases table. The
 * page rendered the first, then the 30-second auto-refresh replaced it with the
 * second, so "إجمالي التكلفة" flipped to 0 — while the product table right below
 * it, which never changed source, kept showing real per-product costs.
 *
 * `totals.cost` is now cost of goods sold — Σ(unit cost from the recipe × units
 * sold) — which is what the card says it is and what the table it sits above
 * adds up to. Purchase spend is a different figure (money out the door this
 * month, whenever those materials get used) and is returned separately as
 * `totals.purchaseCost`; the dashboard's "ربح الشهر" is the one built on it.
 */

export interface ReportProduct {
  name: string
  qty: number
  revenue: number
  cost: number
  profit: number
  margin: number | null
  unitCost: number
  sellPrice: number
}

export interface ReportTotals {
  revenue: number
  cost: number
  profit: number
  avgMargin: number
  /** Purchases recorded this month. Cash out, not cost of what was sold. */
  purchaseCost: number
}

export interface ReportPayload {
  data: ReportProduct[]
  totals: ReportTotals
  prodSummary: {
    recipe_name: string
    output_unit: string
    total: number
    unitCost: number
    totalCost: number
  }[]
  weeklySales: { day: string; total: number }[]
  comparison: {
    thisMonth: { revenue: number; profit: number }
    lastMonth: { revenue: number; profit: number }
  }
}

function monthStartOf(d: Date) {
  return d.toISOString().slice(0, 7) + '-01'
}

function prevMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return monthStartOf(d)
}

export async function buildReport(bakery_id: string | null): Promise<ReportPayload> {
  const monthStart = monthStartOf(new Date())
  const prevStart = prevMonthStart()
  const prevEnd = monthStart

  // recipes and stock are fetched in full: they are small, and unit cost is
  // business logic worth keeping readable. Everything row-heavy stays in the
  // database as an aggregate — this page refreshes every 30 seconds.
  const [recipes, stock, salesByRecipe, prevSalesByRecipe, prodByRecipe,
         weeklySales, monthRev, prevRev, monthPurchaseCost] = await Promise.all([
    listRecipes(bakery_id),
    listStock(bakery_id),
    getSalesByRecipe(bakery_id as string, monthStart),
    getSalesByRecipe(bakery_id as string, prevStart, prevEnd),
    getProductionByRecipe(bakery_id as string, monthStart),
    getWeeklySales(bakery_id),
    getSalesRevenue(bakery_id as string, monthStart),
    getSalesRevenue(bakery_id as string, prevStart, prevEnd),
    getPurchaseCostInRange(bakery_id, monthStart),
  ])

  const stockByName = new Map<string, any>()
  for (const s of (stock || [])) stockByName.set(s.name, s)

  const getUnitCost = (recipe: any) => {
    const total = (recipe.ingredients || []).reduce((s: number, ing: any) => {
      const m = stockByName.get(ing.material)
      return s + (m ? m.price_per_unit * ing.amount : 0)
    }, 0)
    const units = recipe.units_per_batch || recipe.output_qty || 1
    return units > 0 ? total / units : 0
  }

  // Unit cost is memoised per recipe so the per-product rows, the production
  // summary and last month's COGS all use the identical figure.
  const unitCosts = new Map<string, number>()
  for (const r of (recipes || [])) unitCosts.set(r.id, getUnitCost(r))

  const data: ReportProduct[] = (recipes || []).map((r: any) => {
    const agg = salesByRecipe.get(r.id)
    const qty = agg?.qty ?? 0
    const revenue = agg?.revenue ?? 0
    const unitCost = unitCosts.get(r.id) ?? 0
    const cost = unitCost * qty
    const profit = revenue - cost
    return {
      name: r.name,
      qty,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : null,
      unitCost,
      sellPrice: r.sell_price || 0,
    }
  }).filter(d => d.qty > 0 || d.revenue > 0)

  const prodSummary = prodByRecipe.map(p => {
    const unitCost = unitCosts.get(p.recipe_id) ?? 0
    return {
      recipe_name: p.recipe_name,
      output_unit: p.output_unit,
      total: p.total,
      unitCost,
      totalCost: p.total * unitCost,
    }
  })

  // Totals come from the same per-product numbers the table shows, so the cards
  // and the rows can never tell different stories.
  const cost = data.reduce((s, d) => s + d.cost, 0)
  const revenue = data.reduce((s, d) => s + d.revenue, 0)
  const profit = revenue - cost

  // Last month, costed the same way.
  let prevCost = 0
  prevSalesByRecipe.forEach((agg, recipe_id) => {
    prevCost += (unitCosts.get(recipe_id) ?? 0) * agg.qty
  })

  return {
    data,
    totals: {
      revenue,
      cost,
      profit,
      avgMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
      purchaseCost: monthPurchaseCost,
    },
    prodSummary,
    weeklySales,
    comparison: {
      // `revenue` above only counts recipes still on the menu; the month total
      // from the aggregate counts every sale, including deleted products.
      thisMonth: { revenue: monthRev, profit: monthRev - cost },
      lastMonth: { revenue: prevRev, profit: prevRev - prevCost },
    },
  }
}
