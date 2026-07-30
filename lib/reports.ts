import { getDailySales, getSalesRevenue, getSalesByRecipe } from './db/sales'
import { listRecipes } from './db/recipes'
import { listStock } from './db/stock'
import { getProductionByRecipe } from './db/production'
import { getPurchaseCostInRange } from './db/purchases'
import { resolveRange, fromBound, toBound, pctChange, type RangeInput, type ResolvedRange } from './reportRange'

/**
 * The reports payload, built in exactly one place.
 *
 * `pages/reports.tsx` (getServerSideProps) and `/api/reports` both render the
 * same figures, and each used to compute them its own way: the page summed
 * recipe cost × quantity sold, the API summed the purchases table. The page
 * rendered the first, then the 30-second auto-refresh replaced it with the
 * second, so "إجمالي التكلفة" flipped to 0 — while the product table right below
 * it, which never changed source, kept showing real per-product costs.
 *
 * `totals.cost` is cost of goods sold — Σ(unit cost from the recipe × units
 * sold) — which is what the card says it is and what the table it sits above
 * adds up to. Purchase spend is a different figure (money out the door in the
 * period, whenever those materials get used) and is returned separately as
 * `totals.purchaseCost`; the dashboard's "ربح الشهر" is the one built on it.
 *
 * Every figure is bounded by the same resolved range, and every one of them has
 * a counterpart from the comparable earlier window so the page can show a
 * direction rather than a number with no context.
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
  /** Units sold in the comparison window — null when the product had no sales then. */
  prevQty: number | null
  /** Share of the period's revenue, 0–100. */
  share: number
}

export interface ReportTotals {
  revenue: number
  cost: number
  profit: number
  avgMargin: number
  /** Purchases recorded in the period. Cash out, not cost of what was sold. */
  purchaseCost: number
  /** Distinct products with at least one sale. */
  productsSold: number
  unitsSold: number
}

export interface ReportPayload {
  range: ResolvedRange
  data: ReportProduct[]
  totals: ReportTotals
  /** The same totals over `range.prev`, and the percentage change between them. */
  previous: {
    revenue: number
    cost: number
    profit: number
    purchaseCost: number
  }
  change: {
    revenue: number | null
    cost: number | null
    profit: number | null
    purchaseCost: number | null
  }
  prodSummary: {
    recipe_name: string
    output_unit: string
    total: number
    unitCost: number
    totalCost: number
  }[]
  /** One point per day across the range — what the chart draws. */
  daily: { day: string; total: number }[]
  /** Products priced at or below what they cost to make. */
  warnings: { name: string; unitCost: number; sellPrice: number; kind: 'no_price' | 'below_cost' }[]
}

export async function buildReport(
  bakery_id: string | null,
  rangeInput: RangeInput = {},
  now: Date = new Date()
): Promise<ReportPayload> {
  const range = resolveRange(rangeInput, now)
  const from = fromBound(range.from)
  const to = toBound(range.to)
  const prevFrom = fromBound(range.prev.from)
  const prevTo = toBound(range.prev.to)

  // recipes and stock are fetched in full: they are small, and unit cost is
  // business logic worth keeping readable. Everything row-heavy stays in the
  // database as an aggregate — this page refreshes every 30 seconds.
  const [recipes, stock, salesByRecipe, prevSalesByRecipe, prodByRecipe,
         daily, periodRev, prevRev, purchaseCost, prevPurchaseCost] = await Promise.all([
    listRecipes(bakery_id),
    listStock(bakery_id),
    getSalesByRecipe(bakery_id as string, from, to),
    getSalesByRecipe(bakery_id as string, prevFrom, prevTo),
    getProductionByRecipe(bakery_id as string, from, to),
    getDailySales(bakery_id, range.from, range.to),
    getSalesRevenue(bakery_id as string, from, to),
    getSalesRevenue(bakery_id as string, prevFrom, prevTo),
    getPurchaseCostInRange(bakery_id, from, to),
    getPurchaseCostInRange(bakery_id, prevFrom, prevTo),
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
  // summary and the comparison window's COGS all use the identical figure.
  const unitCosts = new Map<string, number>()
  for (const r of (recipes || [])) unitCosts.set(r.id, getUnitCost(r))

  const rows = (recipes || []).map((r: any) => {
    const agg = salesByRecipe.get(r.id)
    const qty = agg?.qty ?? 0
    const revenue = agg?.revenue ?? 0
    const unitCost = unitCosts.get(r.id) ?? 0
    const cost = unitCost * qty
    const profit = revenue - cost
    const prev = prevSalesByRecipe.get(r.id)
    return {
      name: r.name,
      qty,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : null,
      unitCost,
      sellPrice: r.sell_price || 0,
      prevQty: prev ? prev.qty : null,
      share: 0,
    }
  }).filter(d => d.qty > 0 || d.revenue > 0)

  const revenue = rows.reduce((s, d) => s + d.revenue, 0)
  const cost = rows.reduce((s, d) => s + d.cost, 0)
  const profit = revenue - cost

  const data: ReportProduct[] = rows.map(d => ({
    ...d,
    share: revenue > 0 ? (d.revenue / revenue) * 100 : 0,
  }))

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

  // Same costing applied to the comparison window.
  let prevCost = 0
  prevSalesByRecipe.forEach((agg, recipe_id) => {
    prevCost += (unitCosts.get(recipe_id) ?? 0) * agg.qty
  })
  const prevProfit = prevRev - prevCost

  // A product sold below what it costs to make loses money on every sale, and
  // the margin column shows that only if someone reads every row. Recipes with
  // no sales are included: the price is wrong whether or not anyone bought one.
  const warnings = (recipes || [])
    .map((r: any) => {
      const unitCost = unitCosts.get(r.id) ?? 0
      const sellPrice = r.sell_price || 0
      if (unitCost <= 0) return null
      if (sellPrice <= 0) return { name: r.name, unitCost, sellPrice, kind: 'no_price' as const }
      if (sellPrice <= unitCost) return { name: r.name, unitCost, sellPrice, kind: 'below_cost' as const }
      return null
    })
    .filter(Boolean) as ReportPayload['warnings']

  return {
    range,
    data,
    totals: {
      // `revenue` here only counts recipes still on the menu; periodRev from the
      // aggregate counts every sale, including products since deleted. The card
      // shows the aggregate so the headline is the real till total, and the
      // table's own subtotal is what the rows add up to.
      revenue: periodRev,
      cost,
      profit: periodRev - cost,
      avgMargin: periodRev > 0 ? ((periodRev - cost) / periodRev) * 100 : 0,
      purchaseCost,
      productsSold: data.length,
      unitsSold: data.reduce((s, d) => s + d.qty, 0),
    },
    previous: {
      revenue: prevRev,
      cost: prevCost,
      profit: prevProfit,
      purchaseCost: prevPurchaseCost,
    },
    change: {
      revenue: pctChange(periodRev, prevRev),
      cost: pctChange(cost, prevCost),
      profit: pctChange(periodRev - cost, prevProfit),
      purchaseCost: pctChange(purchaseCost, prevPurchaseCost),
    },
    prodSummary,
    daily,
    warnings,
  }
}
