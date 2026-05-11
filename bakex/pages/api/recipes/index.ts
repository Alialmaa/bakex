import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('recipes').select('*').order('name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { name, output_qty, output_unit, sell_price, ingredients } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabaseAdmin.from('recipes').insert({
      name, output_qty: output_qty || 1, output_unit: output_unit || 'حبة',
      sell_price: sell_price || 0, ingredients: ingredients || []
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, name, output_qty, output_unit, sell_price, ingredients } = req.body
    const update: any = {}
    if (name !== undefined) update.name = name
    if (output_qty !== undefined) update.output_qty = output_qty
    if (output_unit !== undefined) update.output_unit = output_unit
    if (sell_price !== undefined) update.sell_price = sell_price
    if (ingredients !== undefined) update.ingredients = ingredients
    const { data, error } = await supabaseAdmin.from('recipes').update(update).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await supabaseAdmin.from('recipes').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
