import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { createBakery } from '../../../lib/db/bakeries'
import { hashPassword } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, RATE_LIMITS } from '../../../lib/rateLimit'
import { clientIp } from '../../../lib/clientIp'
import { sendVerificationEmail } from '../../../lib/email'
import { appUrl } from '../../../lib/appUrl'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { bakery_name, name, username, password, email, phone } = req.body
  if (!bakery_name || !name || !username || !password || !email || !phone)
    return res.redirect(302, '/register?error=missing')
  if (typeof bakery_name !== 'string' || bakery_name.length > 100)
    return res.redirect(302, '/register?error=invalid_input')
  if (typeof name !== 'string' || name.length > 100)
    return res.redirect(302, '/register?error=invalid_input')
  if (typeof username !== 'string' || username.length > 50)
    return res.redirect(302, '/register?error=invalid_input')
  if (typeof email !== 'string' || email.length > 200 || !email.includes('@'))
    return res.redirect(302, '/register?error=invalid_email')
  if (typeof phone !== 'string' || phone.length > 20)
    return res.redirect(302, '/register?error=invalid_input')
  if (password.length < 6)
    return res.redirect(302, '/register?error=short_password')

  const limit = await checkRateLimit(`register:${clientIp(req)}`, RATE_LIMITS.register)
  if (!limit.allowed) return res.redirect(302, '/register?error=rate_limited')

  try {
    const { data: existing } = await supabaseAdmin
      .from('users').select('id').eq('username', username).single()
    if (existing) return res.redirect(302, '/register?error=username_taken')

    const bakery = await createBakery(bakery_name)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const perms = { dashboard: true, stock: true, produce: true, sales: true, cost: true, reports: true, users: true }

    const { data: newUser, error } = await supabaseAdmin.from('users').insert({
      name, username,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password_hash: hashPassword(password),
      role: 'admin',
      perms,
      bakery_id: bakery.id,
      status: 'active',
      email_verified: false,
      email_verification_token: verificationToken,
    }).select().single()

    if (error || !newUser) return res.redirect(302, '/register?error=create_failed')

    // Send verification email
    try {
      const verifyLink = appUrl(`/api/auth/verify-email?token=${verificationToken}`)
      await sendVerificationEmail(email.trim().toLowerCase(), verifyLink)
    } catch {
      // Non-critical — user can request resend later
    }

    // Redirect to a "check your email" page instead of logging in directly
    return res.redirect(302, '/register?success=verify_email')
  } catch {
    return res.redirect(302, '/register?error=create_failed')
  }
}
