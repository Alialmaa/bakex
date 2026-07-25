import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { parse, serialize } from 'cookie'
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from './supabase'
import { checkBakeryAccess } from './subscription'

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

// Live user state, read from the DB rather than trusted from the JWT.
// Cached briefly so the common case costs no roundtrip: a revoked user loses
// access within VC_TTL instead of when their 8h token finally expires.
interface UserState {
  tokenVersion: number
  status: string
  role: string
  perms: Record<string, boolean>
  bakery_id: string | null
}

const _vc = new Map<string, { state: UserState | null; t: number }>()
const VC_TTL = 30_000

export function invalidateUserCache(userId: string) {
  _vc.delete(userId)
}

async function loadUserState(userId: string): Promise<UserState | null> {
  const now = Date.now()
  const hit = _vc.get(userId)
  if (hit && now - hit.t < VC_TTL) return hit.state

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('token_version, status, role, perms, bakery_id')
    .eq('id', userId)
    .single()

  // A read failure must not resolve to "valid" — that would make every revoked
  // session work again the moment the database hiccups. Propagate instead, so
  // the caller can decide, and do not cache the failure.
  if (error) throw error
  if (!data) {
    _vc.set(userId, { state: null, t: now })
    return null
  }

  const state: UserState = {
    tokenVersion: data.token_version ?? 0,
    status: data.status ?? 'active',
    role: data.role,
    perms: (data.perms as Record<string, boolean>) ?? {},
    bakery_id: data.bakery_id ?? null,
  }
  _vc.set(userId, { state, t: now })
  return state
}

/**
 * Verifies the session against the database and returns the caller with fresh
 * role/permissions, or null if the session is no longer valid.
 *
 * The JWT carries a snapshot of role and perms from login time. Trusting that
 * snapshot means a demotion or a revoked permission does not take effect until
 * the token expires, so both are re-read here.
 */
async function resolveSession(tokenUser: any): Promise<any | null> {
  if (!tokenUser?.id) return null
  if (tokenUser.tv === undefined) return tokenUser // legacy token, pre-token_version

  const state = await loadUserState(tokenUser.id)
  if (!state) return null
  if (state.tokenVersion !== tokenUser.tv) return null
  if (state.status !== 'active') return null

  return {
    ...tokenUser,
    role: state.role,
    perms: state.perms,
    bakery_id: state.bakery_id,
  }
}

export interface AuthOptions {
  skipSubscription?: boolean
}

export const isSuperAdmin = (user: any) => user?.role === 'super_admin'

export const requireAuth = async (
  req: NextApiRequest,
  res: NextApiResponse,
  opts?: AuthOptions
) => {
  const tokenUser = getUser(req)
  if (!tokenUser) { res.status(401).json({ error: 'Unauthorized' }); return null }

  let user: any
  try {
    user = await resolveSession(tokenUser)
  } catch {
    res.status(503).json({ error: 'Service unavailable. Please try again.' })
    return null
  }
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
    return null
  }

  if (user.bakery_id && !isSuperAdmin(user) && !opts?.skipSubscription) {
    const access = await checkBakeryAccess(user.bakery_id)
    if (!access.allowed) {
      res.status(402).json({
        error: 'subscription_expired',
        status: access.status,
        daysLeft: 0,
      })
      return null
    }
  }

  return user
}

export const requirePerm = async (
  req: NextApiRequest,
  res: NextApiResponse,
  perm: string,
  opts?: AuthOptions
) => {
  const user = await requireAuth(req, res, opts)
  if (!user) return null
  if (!user.perms?.[perm]) { res.status(403).json({ error: 'Forbidden' }); return null }
  return user
}

// ── getServerSideProps guard ─────────────────────────────────────────────────

type Redirect = { redirect: { destination: string; permanent: false } }
const redirectTo = (destination: string): Redirect =>
  ({ redirect: { destination, permanent: false } })

export interface PageGuardOptions {
  /** Permission names; access is granted if the user holds ANY of them. */
  anyPerm?: string[]
  /** Where to send an unauthenticated visitor. */
  loginTo?: string
  /** Restrict the page to super admins. */
  superAdminOnly?: boolean
  /** Send super admins somewhere else (they have no bakery data to show). */
  redirectSuperAdminTo?: string
  /** Where to send a signed-in user who lacks the permission. */
  denyTo?: string
  /** Skip the subscription check (billing and settings must stay reachable). */
  skipSubscription?: boolean
}

/**
 * Session guard for getServerSideProps. Returns either the caller (with fresh
 * role and permissions) or a redirect to hand straight back to Next.
 *
 * Pages used to call getUser(), which only verifies the JWT signature. That
 * left every page readable with a revoked, demoted or expired-subscription
 * session until the 8h token ran out — and getServerSideProps embeds the
 * fetched rows in the HTML, so the data went out with it.
 */
export async function requirePage(
  req: NextApiRequest,
  opts: PageGuardOptions = {}
): Promise<{ user: any } | Redirect> {
  const loginTo = opts.loginTo ?? '/login'
  const tokenUser = getUser(req)
  if (!tokenUser) return redirectTo(loginTo)

  let user: any
  try {
    user = await resolveSession(tokenUser)
  } catch {
    // The database is unreachable. Refuse rather than serve data to a session
    // we cannot verify.
    return redirectTo('/500')
  }
  if (!user) return redirectTo(loginTo)

  if (isSuperAdmin(user)) {
    if (opts.redirectSuperAdminTo) return redirectTo(opts.redirectSuperAdminTo)
    return { user }
  }
  if (opts.superAdminOnly) return redirectTo('/')

  if (opts.anyPerm?.length && !opts.anyPerm.some(p => user.perms?.[p])) {
    return redirectTo(opts.denyTo ?? '/403')
  }

  if (user.bakery_id && !opts.skipSubscription) {
    const access = await checkBakeryAccess(user.bakery_id)
    if (!access.allowed) return redirectTo('/billing')
  }

  return { user }
}

export const isRedirect = (r: { user: any } | Redirect): r is Redirect => 'redirect' in r

/**
 * True only if the caller holds a session the database still accepts.
 *
 * Login pages use this to decide whether to bounce a visitor to the app. They
 * must not settle for a syntactically valid JWT: a revoked token would send the
 * visitor to /dashboard, whose guard would send them straight back here, and
 * the two would redirect at each other forever.
 */
export async function hasValidSession(req: NextApiRequest): Promise<boolean> {
  const tokenUser = getUser(req)
  if (!tokenUser) return false
  try {
    return (await resolveSession(tokenUser)) !== null
  } catch {
    return false
  }
}
