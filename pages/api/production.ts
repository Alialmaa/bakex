import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { date } = req.query
    let query = supabaseAdmin.from('production_log').select('*').order('created_at', { ascending: false })
    if (date) {
      const start = `${date}T00:00:00`
      const end = `${date}T23:59:59`
      query = query.gte('created_at', start).lte('created_at', end)
    }
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, output_qty } = req.body
    const { error } = await supabaseAdmin.from('production_log').update({ output_qty }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const { error } = await supabaseAdmin.from('production_log').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
