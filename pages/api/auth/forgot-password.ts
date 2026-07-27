import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/supabase'
import { sendPasswordResetEmail } from '../../../lib/email'
import { appUrl } from '../../../lib/appUrl'
import { checkRateLimit, RATE_LIMITS } from '../../../lib/rateLimit'
import { clientIp } from '../../../lib/clientIp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email || typeof email !== 'string' || !email.includes('@'))
    return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح' })

  const normalised = email.trim().toLowerCase()

  // Unlimited before: every call sent a billable email, so anyone could fill a
  // victim's inbox and burn the Resend quota that new customers need for their
  // verification mail.
  //
  // A rejected request returns the same body as an unknown address. Answering
  // 429 here would tell an attacker the address exists, which is exactly what
  // the uniform response below is there to hide.
  const ipLimit = await checkRateLimit(`pwreset:ip:${clientIp(req)}`, RATE_LIMITS.passwordReset)
  const mailLimit = await checkRateLimit(`pwreset:mail:${normalised}`, RATE_LIMITS.passwordReset)
  if (!ipLimit.allowed || !mailLimit.allowed) return res.status(200).json({ success: true })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('email', normalised)
    .single()

  // Always return success to avoid leaking which emails are registered
  if (!user) return res.status(200).json({ success: true })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('users')
    .update({ reset_token: token, reset_token_expires_at: expires })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: 'حدث خطأ، حاول مجدداً' })

  const resetLink = appUrl(`/reset-password?token=${token}`)

  try {
    await sendPasswordResetEmail(normalised, resetLink)
  } catch {
    return res.status(500).json({ error: 'تعذّر إرسال الإيميل، تحقق من إعدادات Resend' })
  }

  return res.status(200).json({ success: true })
}
