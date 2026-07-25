import { supabaseAdmin } from './supabase'

export interface RateLimitRule {
  /** Rolling window length, in seconds. */
  windowSec: number
  /** Attempts allowed within the window before requests are rejected. */
  max: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

/** Every limit the app applies, in one place. */
export const RATE_LIMITS = {
  /** Per IP + username, the noisy-source guard. */
  login: { windowSec: 60, max: 5 },
  /** Per account regardless of IP. Only failures count — see login.ts. */
  loginAccount: { windowSec: 900, max: 10 },
  register: { windowSec: 60, max: 5 },
  /** Password-reset requests. Each one sends a billable email. */
  passwordReset: { windowSec: 900, max: 5 },
  resetToken: { windowSec: 900, max: 10 },
  changePassword: { windowSec: 900, max: 10 },
} satisfies Record<string, RateLimitRule>

const NS = 'bakex:rl:'
const useRedis = () =>
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

// ── In-memory fallback ───────────────────────────────────────────────────────
// Last resort only. A serverless deployment runs many instances, so this
// counter is per-instance and an attacker rotating connections sees it reset;
// it is here so a backend outage degrades protection rather than removing it.

interface Bucket { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

setInterval(() => {
  const now = Date.now()
  buckets.forEach((b, key) => {
    if (now - b.windowStart > 3_600_000) buckets.delete(key)
  })
}, 600_000).unref?.()

function memHit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  const windowMs = rule.windowSec * 1000
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: 1 <= rule.max, retryAfterSec: rule.windowSec }
  }
  bucket.count++
  const retryAfterSec = Math.max(0, Math.ceil((bucket.windowStart + windowMs - now) / 1000))
  return { allowed: bucket.count <= rule.max, retryAfterSec }
}

function memPeek(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  const windowMs = rule.windowSec * 1000
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) return { allowed: true, retryAfterSec: 0 }
  const retryAfterSec = Math.max(0, Math.ceil((bucket.windowStart + windowMs - now) / 1000))
  return { allowed: bucket.count < rule.max, retryAfterSec }
}

// ── Upstash Redis (optional; fastest when configured) ────────────────────────

async function redis(commands: unknown[][]): Promise<any[]> {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`)
  return res.json()
}

async function redisHit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  // EXPIRE ... NX sets the TTL only if none exists, so the window is fixed from
  // the first attempt rather than sliding forward with every new one.
  const out = await redis([
    ['INCR', NS + key],
    ['EXPIRE', NS + key, rule.windowSec, 'NX'],
    ['PTTL', NS + key],
  ])
  const hits = Number(out[0].result)
  const ttlMs = Number(out[2].result)
  return {
    allowed: hits <= rule.max,
    retryAfterSec: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : rule.windowSec,
  }
}

async function redisPeek(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const out = await redis([['GET', NS + key], ['PTTL', NS + key]])
  const hits = Number(out[0].result ?? 0)
  const ttlMs = Number(out[1].result)
  return {
    allowed: hits < rule.max,
    retryAfterSec: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : 0,
  }
}

// ── Postgres (default) ───────────────────────────────────────────────────────

async function pgHit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
    p_key: key,
    p_window_sec: rule.windowSec,
    p_max: rule.max,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('rate_limit_hit returned no row')
  return { allowed: Boolean(row.allowed), retryAfterSec: Number(row.retry_after_sec) || 0 }
}

async function pgPeek(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin
    .from('rate_limits')
    .select('hits, window_start')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  if (!data) return { allowed: true, retryAfterSec: 0 }

  const windowEnds = new Date(data.window_start).getTime() + rule.windowSec * 1000
  if (Date.now() >= windowEnds) return { allowed: true, retryAfterSec: 0 }
  return {
    allowed: data.hits < rule.max,
    retryAfterSec: Math.max(0, Math.ceil((windowEnds - Date.now()) / 1000)),
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Records an attempt against `key` and reports whether it is allowed. */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule = RATE_LIMITS.login
): Promise<RateLimitResult> {
  try {
    return useRedis() ? await redisHit(key, rule) : await pgHit(key, rule)
  } catch {
    return memHit(key, rule)
  }
}

/**
 * Reads the current state without recording an attempt.
 *
 * Used where only failures should count — checking the limit on the way in
 * must not itself consume an attempt, or a user typing their password
 * correctly would be pushed toward a lockout.
 *
 * Note the strict comparison: this answers "is there room for another attempt",
 * whereas checkRateLimit answers "was the attempt just recorded within budget".
 * Using `<=` here would let one more attempt through than the rule allows.
 */
export async function peekRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  try {
    return useRedis() ? await redisPeek(key, rule) : await pgPeek(key, rule)
  } catch {
    return memPeek(key, rule)
  }
}

/** Clears a counter, e.g. after a successful login. */
export async function resetRateLimit(key: string): Promise<void> {
  buckets.delete(key)
  try {
    if (useRedis()) await redis([['DEL', NS + key]])
    else await supabaseAdmin.from('rate_limits').delete().eq('key', key)
  } catch {
    // A counter that fails to clear only means a slightly tighter limit.
  }
}
