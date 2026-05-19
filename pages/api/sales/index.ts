import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { from, to } = req.query
    let query = supabaseAdmin.from('sales').select('*').order('created_at', { ascending: false })
    if (from) query = query.gte('created_at', from as string)
    if (to) query = query.lte('created_at', to as string)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { entries, date } = req.body
    const created_at = date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString()
    const rows = entries.map((e: any) => ({ ...e, sold_by: user.id, created_at }))
    const { data, error } = await supabaseAdmin.from('sales').insert(rows).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await supabaseAdmin.from('sales').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
