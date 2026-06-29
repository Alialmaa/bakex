import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { createSales } from '../../../lib/db/sales'
import { requirePositiveNumber } from '../../../lib/validate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned to this account. Please log out and log in again.' })

  if (req.method === 'GET') {
    const { from, to, limit = 50 } = req.query
    let query = supabaseAdmin
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (bakery_id) query = query.eq('bakery_id', bakery_id)
    if (from) query = query.gte('created_at', from as string)
    if (to) query = query.lte('created_at', to as string)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { customer_name, items, total, subtotal_excl_vat, vat_amount, vat_rate, payment_method } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }
    const totalErr = requirePositiveNumber(total, 'total')
    if (totalErr) return res.status(400).json({ error: totalErr })

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()) {
        return res.status(400).json({ error: `items[${i}].name is required` })
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        return res.status(400).json({ error: `items[${i}].qty must be a positive number` })
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return res.status(400).json({ error: `items[${i}].price must be a non-negative number` })
      }
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    // Uses an atomic DB counter (next_invoice_seq) so concurrent sales never collide.
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

    const { data: seqNum, error: seqErr } = await supabaseAdmin
      .rpc('next_invoice_seq', { p_bakery_id: bakery_id, p_date_key: dateStr })
    if (seqErr) return res.status(500).json({ error: seqErr.message })
    const invoice_number = `INV-${dateStr}-${String(seqNum).padStart(4, '0')}`

    // 1. Create invoice record
    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        bakery_id: bakery_id || null,
        invoice_number,
        customer_name: customer_name || null,
        items,
        subtotal: subtotal_excl_vat || total,
        subtotal_excl_vat: subtotal_excl_vat || total,
        vat_rate: vat_rate || 15,
        vat_amount: vat_amount || 0,
        total,
        payment_method: payment_method || 'cash',
      })
      .select()
      .single()

    if (invoiceErr || !invoice) return res.status(500).json({ error: invoiceErr?.message || 'Failed to create invoice' })

    // 2. Record sales entries (syncs with bakery dashboard + reports)
    try {
      const salesEntries = items.map((item: any) => ({
        recipe_id: item.id,
        recipe_name: item.name,
        qty: item.qty,
        unit_price: item.price,
        total: item.price * item.qty,
      }))
      await createSales(bakery_id, salesEntries, user.id)
    } catch (e) {
      // Sales sync failed — invoice was created, log but don't fail the request
      console.error('Sales sync error:', e)
    }

    // 3. Deduct stock based on recipe ingredients
    try {
      // Fetch recipes with their ingredients
      const recipeIds = items.map((i: any) => i.id)
      const { data: recipes } = await supabaseAdmin
        .from('recipes')
        .select('id, ingredients, units_per_batch, output_qty')
        .in('id', recipeIds)

      if (recipes?.length) {
        for (const item of items) {
          const recipe = recipes.find((r: any) => r.id === item.id)
          if (!recipe?.ingredients?.length) continue

          const unitsPerBatch = recipe.units_per_batch || recipe.output_qty || 1

          for (const ing of recipe.ingredients) {
            if (!ing.material || !ing.amount) continue

            // Amount to deduct = sold_qty * (ingredient_amount / units_per_batch)
            const deductAmount = item.qty * (ing.amount / unitsPerBatch)

            // Find stock item by name in this bakery
            let stockQuery = supabaseAdmin
              .from('stock')
              .select('id, qty')
              .eq('name', ing.material)
            if (bakery_id) stockQuery = stockQuery.eq('bakery_id', bakery_id)
            const { data: stockItems } = await stockQuery.limit(1)

            if (stockItems?.[0]) {
              const newQty = Math.max(0, (stockItems[0].qty || 0) - deductAmount)
              await supabaseAdmin
                .from('stock')
                .update({ qty: newQty })
                .eq('id', stockItems[0].id)
            }
          }
        }
      }
    } catch (e) {
      // Stock deduction failed — non-critical, continue
      console.error('Stock deduction error:', e)
    }

    return res.status(200).json(invoice)
  }

  res.status(405).end()
}
