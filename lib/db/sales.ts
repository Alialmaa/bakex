import { supabaseAdmin } from '../supabase'
import { businessToday, dayStamp, addDays } from '../businessDay'

/** Rows are for display; totals should come from the aggregate helpers below. */
const LIST_LIMIT = 500

export async function listSales(bakery_id: string | null, from?: string, to?: string, limit = LIST_LIMIT) {
  let query = supabaseAdmin.from('sales').select('*').order('created_at', { ascending: false }).limit(limit)
  if (bakery_id) query = query.eq('bakery_id', bakery_id)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Total revenue for a period, summed in Postgres. */
export async function getSalesRevenue(bakery_id: string, from: string, to?: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('sales_revenue', {
    p_bakery_id: bakery_id, p_from: from, p_to: to ?? null,
  })
  if (error) throw error
  return Number(data) || 0
}

/** Quantity and revenue per recipe, grouped in Postgres. */
export async function getSalesByRecipe(
  bakery_id: string, from: string, to?: string
): Promise<Map<string, { qty: number; revenue: number }>> {
  const { data, error } = await supabaseAdmin.rpc('sales_by_recipe', {
    p_bakery_id: bakery_id, p_from: from, p_to: to ?? null,
  })
  if (error) throw error
  const map = new Map<string, { qty: number; revenue: number }>()
  for (const row of (data as any[]) || []) {
    if (!row.recipe_id) continue
    map.set(row.recipe_id, { qty: Number(row.qty) || 0, revenue: Number(row.revenue) || 0 })
  }
  return map
}

export interface SaleEntry {
  recipe_id: string
  recipe_name?: string
  qty: number
  unit_price: number
}

export async function createSales(bakery_id: string, entries: SaleEntry[], sold_by: string, date?: string) {
  // A sale recorded *for* a date is stamped midday in the bakery's timezone, so
  // it lands inside that day whatever the server's own timezone is. The bare
  // `new Date(date + 'T12:00:00')` this replaces was parsed in the server's
  // local time — UTC on Vercel, something else on a laptop.
  const created_at = date ? dayStamp(date) : new Date().toISOString()

  // Each column is set explicitly. This used to spread the caller's object
  // (`{ ...e }`), which handed the client a direct write into every column of
  // the table — including `total`, the figure every financial report sums.
  const rows = entries.map(e => ({
    recipe_id: e.recipe_id,
    recipe_name: typeof e.recipe_name === 'string' ? e.recipe_name.slice(0, 200) : null,
    qty: e.qty,
    unit_price: e.unit_price,
    total: Math.round(e.qty * e.unit_price * 100) / 100,
    bakery_id,
    sold_by,
    created_at,
  }))

  const { data, error } = await supabaseAdmin
    .from('sales')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

export async function deleteSale(id: string, bakery_id: string) {
  const { error } = await supabaseAdmin
    .from('sales')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}

export async function getSalesInRange(bakery_id: string, from: string, to?: string) {
  return listSales(bakery_id, from, to)
}

/**
 * Daily totals across an inclusive `YYYY-MM-DD` range.
 *
 * Days with no sales come back as zero: `sales_daily_totals` fills the gaps
 * with generate_series, and the skeleton is rebuilt here as well so a caller
 * can chart the range without checking whether Postfix answered for every day.
 *
 * Previously this fetched every sale in the window and grouped them in JS —
 * work that duplicated the month-to-date query the same page already ran.
 */
export async function getDailySales(
  bakery_id: string | null, from: string, to: string
): Promise<{ day: string; total: number }[]> {
  const DAY = 86_400_000
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  const count = Math.max(1, Math.round((end - start) / DAY) + 1)
  const days = Array.from({ length: count }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10))

  if (!bakery_id) return days.map(day => ({ day, total: 0 }))

  const { data, error } = await supabaseAdmin.rpc('sales_daily_totals', {
    p_bakery_id: bakery_id, p_from: from, p_to: to,
  })
  if (error) throw error

  const byDay = new Map<string, number>()
  for (const row of (data as any[]) || []) {
    byDay.set(String(row.day).slice(0, 10), Number(row.total) || 0)
  }
  return days.map(day => ({ day, total: byDay.get(day) ?? 0 }))
}

/** The last 7 days, ending today. The dashboard's chart. */
export async function getWeeklySales(bakery_id: string | null): Promise<{ day: string; total: number }[]> {
  const today = businessToday()
  return getDailySales(bakery_id, addDays(today, -6), today)
}
