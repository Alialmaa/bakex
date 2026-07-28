import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseLang, LANG_COOKIE, DEFAULT_LANG } from '../lib/lang'
import { timingSafeEqualStr, generateCode } from '../lib/crypto'
import { clientIp } from '../lib/clientIp'
import { requirePassword, PASSWORD_MIN, PASSWORD_MAX } from '../lib/validate'
import { appUrl, appBaseUrl } from '../lib/appUrl'

describe('parseLang', () => {
  test('reads the cookie', () => {
    assert.equal(parseLang(`${LANG_COOKIE}=en`), 'en')
    assert.equal(parseLang(`a=1; ${LANG_COOKIE}=ar; b=2`), 'ar')
  })

  test('returns null when absent or empty', () => {
    assert.equal(parseLang('other=1'), null)
    assert.equal(parseLang(''), null)
    assert.equal(parseLang(undefined), null)
  })

  test('rejects a value that is not a language we ship', () => {
    assert.equal(parseLang(`${LANG_COOKIE}=fr`), null)
    assert.equal(parseLang(`${LANG_COOKIE}=`), null)
  })

  test('is not fooled by a cookie whose name merely ends the same way', () => {
    assert.equal(parseLang(`my_${LANG_COOKIE}=en`), null)
  })

  test('the default is Arabic, which is what the server renders without a cookie', () => {
    assert.equal(DEFAULT_LANG, 'ar')
  })
})

describe('timingSafeEqualStr', () => {
  test('matches identical strings', () => {
    assert.equal(timingSafeEqualStr('correct-code', 'correct-code'), true)
  })

  test('rejects different strings, including different lengths', () => {
    assert.equal(timingSafeEqualStr('a', 'b'), false)
    assert.equal(timingSafeEqualStr('short', 'much-longer-value'), false)
    assert.equal(timingSafeEqualStr('', 'x'), false)
  })

  test('rejects a prefix, which a short-circuiting compare would leak', () => {
    assert.equal(timingSafeEqualStr('secret', 'secretx'), false)
    assert.equal(timingSafeEqualStr('secretx', 'secret'), false)
  })
})

describe('generateCode', () => {
  test('produces the requested length', () => {
    assert.equal(generateCode(8).length, 8)
  })

  test('does not repeat across many draws', () => {
    // Math.random's state can be recovered from a handful of outputs, which is
    // why this uses crypto. A collision here would mean it is not random enough
    // to be worth calling a code.
    const seen = new Set(Array.from({ length: 500 }, () => generateCode(8)))
    assert.ok(seen.size > 495, `only ${seen.size} distinct codes out of 500`)
  })
})

describe('clientIp', () => {
  test('takes the rightmost forwarded address', () => {
    // The left of x-forwarded-for is whatever the caller wrote; only the entry
    // the proxy appended can be trusted.
    const req: any = { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }, socket: {} }
    assert.equal(clientIp(req), '3.3.3.3')
  })

  test('falls back to the socket when the header is absent', () => {
    assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } } as any), '9.9.9.9')
  })

  test('never returns empty', () => {
    assert.ok(clientIp({ headers: {}, socket: {} } as any).length > 0)
  })
})

describe('requirePassword', () => {
  test('accepts a password at the minimum length', () => {
    assert.equal(requirePassword('x'.repeat(PASSWORD_MIN)), null)
  })

  test('rejects one that is too short', () => {
    assert.ok(requirePassword('x'.repeat(PASSWORD_MIN - 1)))
  })

  test('rejects one past the maximum', () => {
    // bcrypt silently truncates at 72 bytes, so anything longer would make the
    // tail of the password meaningless rather than stronger.
    assert.ok(requirePassword('x'.repeat(PASSWORD_MAX + 1)))
  })

  test('measures bytes, not characters', () => {
    // Arabic characters are two bytes each in UTF-8, so a password well under
    // 72 characters can still cross bcrypt's byte boundary.
    const arabic = 'ك'.repeat(40)          // 80 bytes
    assert.equal(Buffer.byteLength(arabic, 'utf8'), 80)
    assert.ok(requirePassword(arabic), 'an 80-byte password must be rejected even though it is 40 characters')
  })

  test('rejects a non-string', () => {
    assert.ok(requirePassword(undefined as any))
    assert.ok(requirePassword(12345678 as any))
  })
})

describe('appUrl', () => {
  test('builds links from the configured origin, never from a request', () => {
    // Reset links used to be built from the Host header, which the caller
    // controls — enough to mail a victim a genuine-looking link pointing at
    // someone else's server.
    assert.ok(appUrl('/reset-password?token=abc').startsWith(appBaseUrl()))
    assert.ok(!appBaseUrl().includes('attacker'))
  })

  test('joins paths without doubling the slash', () => {
    assert.ok(!appUrl('/x').replace(/^https?:\/\//, '').includes('//'))
  })
})
