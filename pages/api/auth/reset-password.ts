import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { hashPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token, new_password } = req.body
  if (!token || typeof token !== 'string')
    return res.status(400).json({ error: 'رابط غير صالح' })
  if (!new_password || typeof new_password !== 'string' || new_password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل' })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, reset_token_expires_at, token_version')
    .eq('reset_token', token)
    .single()

  if (!user) return res.status(400).json({ error: 'الرابط غير صالح أو منتهي الصلاحية' })

  if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date())
    return res.status(400).json({ error: 'انتهت صلاحية الرابط — اطلب رابطاً جديداً' })

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      password_hash: hashPassword(new_password),
      token_version: (user.token_version ?? 0) + 1,
      reset_token: null,
      reset_token_expires_at: null,
    })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: 'حدث خطأ، حاول مجدداً' })

  return res.status(200).json({ success: true })
}
