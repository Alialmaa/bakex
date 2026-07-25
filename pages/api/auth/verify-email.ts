import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { token } = req.query
  if (!token || typeof token !== 'string')
    return res.redirect('/verify-email?error=invalid')

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email_verified')
    .eq('email_verification_token', token)
    .single()

  if (!user) return res.redirect('/verify-email?error=invalid')
  if (user.email_verified) return res.redirect('/verify-email?success=already')

  await supabaseAdmin
    .from('users')
    .update({ email_verified: true, email_verification_token: null })
    .eq('id', user.id)

  return res.redirect('/verify-email?success=1')
}
