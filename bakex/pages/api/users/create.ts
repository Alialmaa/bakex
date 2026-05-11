import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { hashPassword } from '../../../lib/auth'
import { comparePassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, username, password, role, perms, adminPass } = req.body

  if (!name || !username || !password || !adminPass)
    return res.status(400).json({ error: 'Missing fields' })

  const { data: admin } = await supabaseAdmin
    .from('users').select('*').eq('role', 'admin').limit(1).single()

  if (!admin || !comparePassword(adminPass, admin.password_hash))
    return res.status(403).json({ error: 'Wrong admin password' })

  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('username', username).single()
  if (existing) return res.status(409).json({ error: 'Username already exists' })

  const { data, error } = await supabaseAdmin.from('users').insert({
    name, username, password_hash: hashPassword(password), role: role || 'staff', perms: perms || {}
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ success: true, user: data })
}
