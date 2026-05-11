import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (!user || error) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Compare password — supports plain: prefix for simplicity
  const stored = user.password_hash as string
  let valid = false

  if (stored.startsWith('plain:')) {
    valid = stored === `plain:${password}`
  } else {
    const bcrypt = require('bcryptjs')
    valid = bcrypt.compareSync(password, stored)
  }

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      perms: user.perms,
    },
    process.env.JWT_SECRET || 'bakex2025secret',
    { expiresIn: '7d' }
  )

  res.setHeader(
    'Set-Cookie',
    serialize('bakex_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
  )

  res.status(200).json({ success: true })
}
