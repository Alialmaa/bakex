import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('stock').select('*').order('name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { name, qty, unit, min_qty, price_per_unit } = req.body
    const { data, error } = await supabaseAdmin.from('stock').insert({ name, qty, unit, min_qty, price_per_unit }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, qty, min_qty, price_per_unit } = req.body
    const { data, error } = await supabaseAdmin.from('stock').update({ qty, min_qty, price_per_unit }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await supabaseAdmin.from('stock').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
