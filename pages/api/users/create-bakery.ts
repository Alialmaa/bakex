import type { NextApiRequest, NextApiResponse } from 'next'
import { createBakery } from '../../../lib/db/bakeries'
import { hashPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit } from '../../../lib/rateLimit'

// Server-side form POST handler — sets cookie then redirects directly
// Avoids any client-side fetch/cookie race conditions
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { bakery_name, name, username, password } = req.body
  if (!bakery_name || !name || !username || !password)
    return res.redirect(302, '/?error=missing')

  if (password.length < 6)
    return res.redirect(302, '/?error=short_password')

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const limit = checkRateLimit(`register:${ip}`)
  if (!limit.allowed) return res.redirect(302, '/?error=rate_limited')

  try {
    const { data: existing } = await supabaseAdmin
      .from('users').select('id').eq('username', username).single()
    if (existing) return res.redirect(302, '/?error=username_taken')

    const bakery = await createBakery(bakery_name)
    const perms = { dashboard: true, stock: true, produce: true, sales: true, cost: true, reports: true, users: true }
    const { data: newUser, error } = await supabaseAdmin.from('users').insert({
      name, username,
      password_hash: hashPassword(password),
      role: 'admin',
      perms,
      bakery_id: bakery.id,
      status: 'active',
    }).select().single()

    if (error || !newUser) return res.redirect(302, '/?error=create_failed')

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
    // Server-side redirect — cookie is guaranteed to be set before browser loads /dashboard
    return res.redirect(302, `/dashboard?new=1&bakery=${encodeURIComponent(bakery.code)}`)
  } catch (e: any) {
    return res.redirect(302, `/?error=${encodeURIComponent(e.message || 'error')}`)
  }
}
