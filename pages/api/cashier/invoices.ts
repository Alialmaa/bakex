import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { createSales } from '../../../lib/db/sales'

const MAX_ITEMS = 200
const MAX_QTY = 1_000_000
const MAX_PRICE = 1_000_000
const PAYMENT_METHODS = ['cash', 'card', 'transfer']

/**
 * VAT rate applied to every invoice, as a fraction.
 *
 * Deliberately 0: the cashier has always posted vat_rate: 0, so every invoice
 * ever issued treats the entered price as final. Switching this on is a pricing
 * decision (it raises what customers pay by 15%), not a security fix — flip it
 * to 0.15 only alongside the cashier UI showing VAT as a separate line.
 */
const VAT_RATE = 0

const round2 = (n: number) => Math.round(n * 100) / 100

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned to this account. Please log out and log in again.' })

  if (req.method === 'GET') {
    const { from, to, limit = '50' } = req.query
    let query = supabaseAdmin
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, Number(limit) || 50), 200))

    if (bakery_id) query = query.eq('bakery_id', bakery_id)
    if (from) query = query.gte('created_at', from as string)
    if (to) query = query.lte('created_at', to as string)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    if (!user.perms?.sales && !user.perms?.cashier) return res.status(403).json({ error: 'Forbidden' })
    const { customer_name, items, payment_method } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ error: `items must contain at most ${MAX_ITEMS} entries` })
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()) {
        return res.status(400).json({ error: `items[${i}].name is required` })
      }
      if (item.name.length > 200) {
        return res.status(400).json({ error: `items[${i}].name is too long` })
      }
      if (typeof item.qty !== 'number' || !Number.isFinite(item.qty) || item.qty <= 0 || item.qty > MAX_QTY) {
        return res.status(400).json({ error: `items[${i}].qty must be a positive number` })
      }
      if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 || item.price > MAX_PRICE) {
        return res.status(400).json({ error: `items[${i}].price must be a non-negative number` })
      }
    }

    if (customer_name !== undefined && customer_name !== null &&
        (typeof customer_name !== 'string' || customer_name.length > 200)) {
      return res.status(400).json({ error: 'customer_name is invalid' })
    }
    if (payment_method !== undefined && !PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'payment_method is invalid' })
    }

    // Money is derived from `items` here and the client's own total / subtotal /
    // vat figures are ignored entirely. They used to be written straight to the
    // invoice, so a cashier could ring up 500 SAR of items, post total: 5, pocket
    // the difference, and file a tax record showing 5.
    const subtotal = round2(items.reduce((s: number, i: any) => s + i.price * i.qty, 0))
    const vat_amount = round2(subtotal * VAT_RATE)
    const total = round2(subtotal + vat_amount)

    if (!(total > 0)) return res.status(400).json({ error: 'Invoice total must be greater than zero' })

    // Store only the fields we validated — an item object may carry anything else.
    const safeItems = items.map((i: any) => ({
      id: typeof i.id === 'string' ? i.id : null,
      name: i.name.trim(),
      qty: i.qty,
      price: i.price,
    }))

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
        bakery_id,
        invoice_number,
        customer_name: customer_name?.trim() || null,
        items: safeItems,
        subtotal,
        subtotal_excl_vat: subtotal,
        vat_rate: VAT_RATE,
        vat_amount,
        total,
        payment_method: payment_method || 'cash',
      })
      .select()
      .single()

    if (invoiceErr || !invoice) return res.status(500).json({ error: invoiceErr?.message || 'Failed to create invoice' })

    // 2. Record sales entries (syncs with bakery dashboard + reports)
    try {
      const salesEntries = safeItems.map(item => ({
        recipe_id: item.id,
        recipe_name: item.name,
        qty: item.qty,
        unit_price: item.price,
      }))
      await createSales(bakery_id, salesEntries, user.id)
    } catch (e) {
      // Sales sync failed — invoice was created, log but don't fail the request
      console.error('Sales sync error:', e)
    }

    // 3. Deduct finished goods from stock (items added to stock during produce step)
    try {
      for (const item of items) {
        const { data: stockItem } = await supabaseAdmin
          .from('stock')
          .select('id, qty')
          .eq('name', item.name)
          .eq('bakery_id', bakery_id)
          .maybeSingle()

        if (stockItem) {
          await supabaseAdmin
            .from('stock')
            .update({ qty: Math.max(0, (stockItem.qty || 0) - item.qty) })
            .eq('id', stockItem.id)
        }
      }
    } catch (e) {
      console.error('Stock deduction error:', e)
    }

    return res.status(200).json(invoice)
  }

  res.status(405).end()
}
