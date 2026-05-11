import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requirePerm } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requirePerm(req, res, 'users')
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('users').select('id,name,username,role,perms,status,created_at').order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, role, perms, status } = req.body
    const update: any = {}
    if (role) update.role = role
    if (perms) update.perms = perms
    if (status) update.status = status
    const { error } = await supabaseAdmin.from('users').update(update).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', id).single()
    if (target?.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' })
    await supabaseAdmin.from('users').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
