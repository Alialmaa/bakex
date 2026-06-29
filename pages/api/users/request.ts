import type { NextApiRequest, NextApiResponse } from 'next'
import { getBakeryByCode, createBakery } from '../../../lib/db/bakeries'
import { requestUser } from '../../../lib/db/users'
import { hashPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, username, password, mode, bakery_name, bakery_code } = req.body

  if (!name || !username || !password)
    return res.status(400).json({ error: 'Missing fields' })

  if (typeof password !== 'string' || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const limit = checkRateLimit(`register:${ip}`)
  if (!limit.allowed) return res.status(429).json({ error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` })

  try {
    if (mode === 'create') {
      if (!bakery_name) return res.status(400).json({ error: 'Bakery name required' })

      const { data: existing } = await supabaseAdmin
        .from('users').select('id').eq('username', username).single()
      if (existing) return res.status(409).json({ error: 'Username already taken' })

      const bakery = await createBakery(bakery_name)

      const perms = { dashboard: true, stock: true, produce: true, sales: true, cost: true, reports: true, users: true }
      const { data: newUser } = await supabaseAdmin.from('users').insert({
        name, username,
        password_hash: hashPassword(password),
        role: 'admin',
        perms,
        bakery_id: bakery.id,
        status: 'active',
      }).select().single()

      // Auto-login after bakery creation
      const token = signToken({
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        perms: newUser.perms,
        bakery_id: bakery.id,
        bakery_name: bakery.name,
      })
      setAuthCookie(res, token)

      return res.status(200).json({ success: true, bakery_code: bakery.code, autoLogin: true })
    }

    if (mode === 'join') {
      if (!bakery_code) return res.status(400).json({ error: 'Bakery code required' })
      const bakery = await getBakeryByCode(bakery_code)
      if (!bakery) return res.status(404).json({ error: 'Bakery not found. Check the code.' })
      await requestUser({ name, username, password, bakery_id: bakery.id })
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid mode' })
  } catch (e: any) {
    const status = e.message === 'Username already taken' ? 409 : 500
    res.status(status).json({ error: e.message })
  }
}
