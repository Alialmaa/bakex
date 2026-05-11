import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { hashPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, username, password } = req.body

  if (!name || !username || !password) return res.status(400).json({ error: 'Missing fields' })

  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('username', username).single()
  if (existing) return res.status(409).json({ error: 'Username already taken' })

  const { error } = await supabaseAdmin.from('users').insert({
    name,
    username,
    password_hash: hashPassword(password),
    role: 'staff',
    perms: {},
    status: 'pending'
  })

  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ success: true })
}
