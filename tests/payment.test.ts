import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { paymentConfig, formatIban, whatsappUrl, YEARLY_PRICE } from '../lib/payment'

/**
 * The billing page renders whatever this returns, so a bad value here is money
 * sent to the wrong place or a customer who cannot pay at all.
 */

const KEYS = ['PAYMENT_LINK_URL', 'BANK_NAME', 'BANK_IBAN', 'BANK_ACCOUNT_NAME', 'SUPPORT_WHATSAPP']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('the payment link', () => {
  test('is absent until one is configured, so the page falls back rather than showing a dead button', () => {
    assert.equal(paymentConfig().link, null)
  })

  test('is accepted when it is https', () => {
    process.env.PAYMENT_LINK_URL = 'https://pay.example.com/bakex-annual'
    assert.equal(paymentConfig().link, 'https://pay.example.com/bakex-annual')
  })

  test('rejects a plain http link', () => {
    // A payment link is where the money goes; it does not travel over http.
    process.env.PAYMENT_LINK_URL = 'http://pay.example.com/x'
    assert.equal(paymentConfig().link, null)
  })

  test('rejects anything that is not a url, including a javascript: payload', () => {
    for (const bad of ['javascript:alert(1)', 'not a url', '', '   ', 'data:text/html,x']) {
      process.env.PAYMENT_LINK_URL = bad
      assert.equal(paymentConfig().link, null, `should have rejected: ${bad}`)
    }
  })

  test('tolerates surrounding whitespace, which env vars collect', () => {
    process.env.PAYMENT_LINK_URL = '  https://pay.example.com/x  '
    assert.equal(paymentConfig().link, 'https://pay.example.com/x')
  })
})

describe('the bank details', () => {
  const full = () => {
    process.env.BANK_NAME = 'مصرف الراجحي'
    process.env.BANK_IBAN = 'SA0380000000608010167519'
    process.env.BANK_ACCOUNT_NAME = 'علي المطيري'
  }

  test('appear only when all three are set', () => {
    full()
    assert.ok(paymentConfig().bank)
  })

  test('are withheld when any one is missing', () => {
    // Half a set of bank details cannot be paid into, so showing them is worse
    // than showing nothing.
    for (const missing of ['BANK_NAME', 'BANK_IBAN', 'BANK_ACCOUNT_NAME']) {
      full()
      delete process.env[missing]
      assert.equal(paymentConfig().bank, null, `should be withheld without ${missing}`)
    }
  })

  test('the IBAN is grouped in fours however it was entered', () => {
    assert.equal(formatIban('SA0380000000608010167519'), 'SA03 8000 0000 6080 1016 7519')
    assert.equal(formatIban('sa03 8000 00006080 1016 7519'), 'SA03 8000 0000 6080 1016 7519')
    assert.equal(formatIban('  SA0380000000608010167519  '), 'SA03 8000 0000 6080 1016 7519')
  })

  test('grouping never drops or invents a character', () => {
    const raw = 'SA0380000000608010167519'
    assert.equal(formatIban(raw).replace(/\s/g, ''), raw)
  })
})

describe('the WhatsApp number', () => {
  test('falls back to the support number when unset', () => {
    assert.match(paymentConfig().whatsapp, /^\d+$/)
  })

  test('strips anything that is not a digit, so a pasted number still works', () => {
    process.env.SUPPORT_WHATSAPP = '+966 55 921 9189'
    assert.equal(paymentConfig().whatsapp, '966559219189')
  })

  test('builds a link with the message encoded', () => {
    const url = whatsappUrl('966559219189', 'أريد الاشتراك في Bakex')
    assert.ok(url.startsWith('https://wa.me/966559219189?text='))
    assert.ok(!url.includes(' '), 'spaces must be encoded or the link breaks')
  })
})

describe('the price', () => {
  test('is the annual figure the pricing page states', () => {
    assert.equal(YEARLY_PRICE, 2500)
    assert.equal(paymentConfig().price, YEARLY_PRICE)
  })
})
