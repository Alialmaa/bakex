import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { comparePassword, hashPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { timingSafeEqualStr } from '../../../lib/crypto'
import { checkRateLimit, peekRateLimit, resetRateLimit, RATE_LIMITS } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { username, password, access_code } = req.body
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const uname = username.toLowerCase()

  const ipLimit = await checkRateLimit(`login:ip:${ip}:${uname}`, RATE_LIMITS.login)
  if (!ipLimit.allowed) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${ipLimit.retryAfterSec}s.` })
  }

  // A second limit on the account itself, so rotating IPs no longer resets the
  // counter. Read without incrementing, and only failures below add to it —
  // otherwise anyone could lock a victim out by guessing at their username.
  const acctKey = `login:acct:${uname}`
  const acctLimit = await peekRateLimit(acctKey, RATE_LIMITS.loginAccount)
  if (!acctLimit.allowed) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${acctLimit.retryAfterSec}s.` })
  }

  const failed = async () => {
    await checkRateLimit(acctKey, RATE_LIMITS.loginAccount)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const { data: user } = await supabaseAdmin
    .from('users').select('*').eq('username', username).single()

  if (!user) return failed()

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

  if (!valid) return failed()

  if (user.status === 'pending')
    return res.status(403).json({ error: 'Account pending approval. Please contact admin.' })
  if (user.status === 'rejected')
    return res.status(403).json({ error: 'Account access denied.' })

  // Email verification check (skip for super_admin)
  if (user.role !== 'super_admin' && user.email_verified === false) {
    return res.status(403).json({ error: 'يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من صندوق الوارد' })
  }

  // Fetch bakery info
  let bakery_name = null
  let bakery_access_code: string | null = null
  if (user.bakery_id) {
    const { data: bakery } = await supabaseAdmin
      .from('bakeries').select('name, access_code').eq('id', user.bakery_id).single()
    bakery_name = bakery?.name ?? null
    bakery_access_code = bakery?.access_code ?? null
  }

  // Access code check (only for non-super-admin bakery accounts that have a code set)
  if (user.role !== 'super_admin' && bakery_access_code) {
    if (!access_code) {
      return res.status(200).json({ needs_code: true })
    }
    if (typeof access_code !== 'string' || !timingSafeEqualStr(access_code, bakery_access_code)) {
      await checkRateLimit(acctKey, RATE_LIMITS.loginAccount)
      return res.status(401).json({ error: 'كود الدخول غير صحيح' })
    }
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    perms: user.perms,
    bakery_id: user.bakery_id ?? null,
    bakery_name,
    tv: user.token_version ?? 0,
  })

  // Correct credentials clear the account counter, so someone guessing against
  // an account can never keep its owner out.
  await resetRateLimit(acctKey)

  setAuthCookie(res, token)
  res.status(200).json({ success: true })
}
