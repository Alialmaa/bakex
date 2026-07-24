const WINDOW_SEC = 60
const MAX_ATTEMPTS = 5

// ── In-memory fallback ────────────────────────────────────────────────────────

interface Bucket { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

setInterval(() => {
  const now = Date.now()
  buckets.forEach((b, key) => {
    if (now - b.windowStart > WINDOW_SEC * 1000) buckets.delete(key)
  })
}, WINDOW_SEC * 1000).unref?.()

function memIncr(key: string): number {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > WINDOW_SEC * 1000) {
    buckets.set(key, { count: 1, windowStart: now })
    return 1
  }
  bucket.count++
  return bucket.count
}

// ── Upstash Redis (persistent, survives cold starts) ─────────────────────────
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your env to enable.

async function redisIncr(key: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, WINDOW_SEC]]),
  })
  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`)
  const data = await res.json()
  return data[0].result as number
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  let count: number

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      count = await redisIncr(`bakex:rl:${key}`)
    } catch {
      count = memIncr(key)
    }
  } else {
    count = memIncr(key)
  }

  if (count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: WINDOW_SEC }
  }
  return { allowed: true, retryAfterSec: 0 }
}
