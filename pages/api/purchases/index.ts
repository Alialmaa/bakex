import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { material_name, qty, unit, pack_weight, pack_price, price_per_unit, notes } = req.body

    // Insert purchase record
    const { data: purchase, error: pErr } = await supabaseAdmin.from('purchases').insert({
      material_name, qty, unit, pack_weight, pack_price, price_per_unit,
      notes, created_by: user.id
    }).select().single()
    if (pErr) return res.status(500).json({ error: pErr.message })

    // Update stock - find material and add qty, update price
    const { data: stockItem } = await supabaseAdmin.from('stock').select('*').eq('name', material_name).single()
    if (stockItem) {
      await supabaseAdmin.from('stock').update({
        qty: stockItem.qty + qty,
        price_per_unit: price_per_unit // update to latest purchase price
      }).eq('name', material_name)
    }

    return res.status(200).json(purchase)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await supabaseAdmin.from('purchases').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
