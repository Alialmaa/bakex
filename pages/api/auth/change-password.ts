import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, comparePassword, hashPassword, signToken, setAuthCookie, invalidateUserCache } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { requirePassword } from '../../../lib/validate'
import { checkRateLimit, RATE_LIMITS } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const limit = await checkRateLimit(`chpw:${user.id}`, RATE_LIMITS.changePassword)
  if (!limit.allowed)
    return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل' })

  const { current_password, new_password } = req.body
  if (typeof current_password !== 'string' || !current_password)
    return res.status(400).json({ error: 'كلمة المرور الحالية مطلوبة' })
  if (typeof new_password !== 'string' || new_password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون ٦ أحرف على الأقل' })
  if (current_password === new_password)
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' })

  const { data: dbUser } = await supabaseAdmin
    .from('users').select('password_hash, token_version').eq('id', user.id).single()

  if (!dbUser) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const stored = dbUser.password_hash as string
  const valid = stored.startsWith('plain:')
    ? stored === `plain:${current_password}`
    : comparePassword(current_password, stored)

  if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' })

  const nextVersion = (dbUser.token_version ?? 0) + 1
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      password_hash: hashPassword(new_password),
      token_version: nextVersion,
    })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: 'تعذّر تغيير كلمة المرور، حاول مجدداً' })

  invalidateUserCache(user.id)

  // Bumping token_version signs out every session, including this one. Reissue
  // the cookie for the device that made the change so only *other* devices are
  // signed out, which is what the UI promises.
  setAuthCookie(res, signToken({ ...user, tv: nextVersion }))

  return res.status(200).json({ success: true })
}
