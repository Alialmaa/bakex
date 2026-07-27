import crypto from 'crypto'

/**
 * Compares two secrets without leaking their length or contents through timing.
 *
 * `a !== b` on strings stops at the first differing byte, so how long the
 * comparison takes depends on how much of the value was correct. Hashing both
 * sides first gives fixed-length buffers, which keeps timingSafeEqual usable
 * even when the two strings differ in length.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest()
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest()
  return crypto.timingSafeEqual(ha, hb)
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * A short human-readable code, from the OS random source.
 *
 * Math.random() is not cryptographically secure: V8's generator state can be
 * recovered from a handful of outputs, so anyone who created a few bakeries
 * could predict the codes handed out afterwards and request to join a bakery
 * they were never given.
 */
export function generateCode(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  }
  return out
}
