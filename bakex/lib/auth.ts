import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { parse, serialize } from 'cookie'
import type { NextApiRequest, NextApiResponse } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'bakex_secret'

export const hashPassword = (password: string) => bcrypt.hashSync(password, 10)
export const comparePassword = (password: string, hash: string) => bcrypt.compareSync(password, hash)

export const signToken = (payload: object) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })

export const verifyToken = (token: string) => {
  try { return jwt.verify(token, JWT_SECRET) as any }
  catch { return null }
}

export const setAuthCookie = (res: NextApiResponse, token: string) => {
  res.setHeader('Set-Cookie', serialize('bakex_token', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/'
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

export const requireAuth = (req: NextApiRequest, res: NextApiResponse) => {
  const user = getUser(req)
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return null }
  return user
}

export const requirePerm = (req: NextApiRequest, res: NextApiResponse, perm: string) => {
  const user = requireAuth(req, res)
  if (!user) return null
  if (!user.perms?.[perm]) { res.status(403).json({ error: 'Forbidden' }); return null }
  return user
}
