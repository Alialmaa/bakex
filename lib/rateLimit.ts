const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

interface Bucket { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

// Periodically drop stale buckets so this map doesn't grow forever on a long-running server.
setInterval(() => {
  const now = Date.now()
  buckets.forEach((b, key) => {
    if (now - b.windowStart > WINDOW_MS) buckets.delete(key)
  })
}, WINDOW_MS).unref?.()

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSec: 0 }
  }

  bucket.count++
  if (bucket.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000)
    return { allowed: false, retryAfterSec }
  }
  return { allowed: true, retryAfterSec: 0 }
}
