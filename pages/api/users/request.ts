import type { NextApiRequest, NextApiResponse } from 'next'
import { getBakeryByCode, createBakery } from '../../../lib/db/bakeries'
import { requestUser } from '../../../lib/db/users'
import { hashPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, RATE_LIMITS } from '../../../lib/rateLimit'
import { clientIp } from '../../../lib/clientIp'
import { apiError } from '../../../lib/apiError'
import { requirePassword } from '../../../lib/validate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, username, password, mode, bakery_name, bakery_code } = req.body

  if (!name || !username || !password)
    return res.status(400).json({ error: 'Missing fields' })
  if (typeof name !== 'string' || name.length > 100)
    return res.status(400).json({ error: 'name must be at most 100 characters' })
  if (typeof username !== 'string' || username.length > 50)
    return res.status(400).json({ error: 'username must be at most 50 characters' })
  const pwErr = requirePassword(password)
  if (pwErr) return res.status(400).json({ error: pwErr })

  const limit = await checkRateLimit(`register:${clientIp(req)}`, RATE_LIMITS.register)
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
        tv: newUser.token_version ?? 0,
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
    if (e.message === 'Username already taken') return res.status(409).json({ error: e.message })
    return apiError(res, e, 'users.request')
  }
}
