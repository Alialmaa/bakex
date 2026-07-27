import type { NextApiRequest } from 'next'

/**
 * Best-effort client address, for rate-limit keys.
 *
 * `x-forwarded-for` is a client-supplied header that the platform appends to,
 * so the leftmost entries can be forged. Behind Vercel the rightmost entry is
 * the one Vercel itself observed, which is why it is preferred here. The value
 * is only ever used as a bucket key, never for authorisation.
 */
export function clientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for']
  const chain = (Array.isArray(xff) ? xff.join(',') : xff ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (chain.length) return chain[chain.length - 1]
  return req.socket.remoteAddress || 'unknown'
}
