import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { parse, serialize } from 'cookie'
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from './supabase'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Refusing to start with an insecure default.')
}
const SECRET = process.env.JWT_SECRET

export const hashPassword = (password: string) => bcrypt.hashSync(password, 10)
export const comparePassword = (password: string, hash: string) => bcrypt.compareSync(password, hash)

export const signToken = (payload: object) =>
  jwt.sign(payload, SECRET, { expiresIn: '8h' })

export const verifyToken = (token: string) => {
  try { return jwt.verify(token, SECRET) as any }
  catch { return null }
}

export const setAuthCookie = (res: NextApiResponse, token: string) => {
  res.setHeader('Set-Cookie', serialize('bakex_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/'
  }))
}

export const clearAuthCookie = (res: NextApiResponse) => {
  res.setHeader('Set-Cookie', serialize('bakex_token', '', { maxAge: 0, path: '/' }))
}

export const getUser = (req: NextApiRequest) => {
  const cookies = parse(req.headers.cookie || '')
  const token = cookies.bakex_token
  if (!token) return null
  return verifyToken(token)
}

// Per-user cache to avoid a DB roundtrip on every single request.
// Entries expire after 30 s — fast enough to act on role/status changes.
const _vc = new Map<string, { v: number; s: string; t: number }>()
const VC_TTL = 30_000

async function isSessionValid(userId: string, tokenVersion: number): Promise<boolean> {
  const now = Date.now()
  const hit = _vc.get(userId)
  if (hit && now - hit.t < VC_TTL) {
    return hit.v === tokenVersion && hit.s === 'active'
  }
  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('token_version, status')
      .eq('id', userId)
      .single()
    if (!data) return false
    _vc.set(userId, { v: data.token_version ?? 0, s: data.status ?? 'active', t: now })
    return (data.token_version ?? 0) === tokenVersion && data.status === 'active'
  } catch {
    // Column not yet migrated — don't break existing sessions, fail open
    return true
  }
}

export const requireAuth = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = getUser(req)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return null }

  if (user.tv !== undefined) {
    const valid = await isSessionValid(user.id, user.tv)
    if (!valid) {
      res.status(401).json({ error: 'Session expired. Please log in again.' })
      return null
    }
  }

  return user
}

export const requirePerm = async (req: NextApiRequest, res: NextApiResponse, perm: string) => {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (!user.perms?.[perm]) { res.status(403).json({ error: 'Forbidden' }); return null }
  return user
}

export const isSuperAdmin = (user: any) => user?.role === 'super_admin'
