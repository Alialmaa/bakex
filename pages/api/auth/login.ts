import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { comparePassword, hashPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { username, password } = req.body
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const limit = checkRateLimit(`login:${ip}:${username.toLowerCase()}`)
  if (!limit.allowed) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` })
  }

  const { data: user } = await supabaseAdmin
    .from('users').select('*').eq('username', username).single()

  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const stored = user.password_hash as string
  let valid = false

  if (stored.startsWith('plain:')) {
    valid = stored === `plain:${password}`
    if (valid) {
      await supabaseAdmin.from('users').update({
        password_hash: hashPassword(password)
      }).eq('id', user.id)
    }
  } else {
    valid = comparePassword(password, stored)
  }

  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  if (user.status === 'pending')
    return res.status(403).json({ error: 'Account pending approval. Please contact admin.' })
  if (user.status === 'rejected')
    return res.status(403).json({ error: 'Account access denied.' })

  // Fetch bakery name for display
  let bakery_name = null
  if (user.bakery_id) {
    const { data: bakery } = await supabaseAdmin
      .from('bakeries').select('name').eq('id', user.bakery_id).single()
    bakery_name = bakery?.name ?? null
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    perms: user.perms,
    bakery_id: user.bakery_id ?? null,
    bakery_name,
  })

  setAuthCookie(res, token)
  res.status(200).json({ success: true })
}
