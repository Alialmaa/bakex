/**
 * Moyasar — the parts of it the server needs to trust.
 *
 * A webhook body is just an HTTP POST: anyone who learns the URL can send one
 * that says "bakery b1 paid 2,500 riyals". So nothing in this file believes a
 * webhook. The token check filters out noise cheaply, and then the payment is
 * read back from Moyasar's own API by id — the only field of the request we
 * ever act on is that id, and even it only as a lookup key.
 *
 * Environment:
 *   MOYASAR_SECRET_KEY     — server-side API key (sk_...). Never sent to the browser.
 *   MOYASAR_WEBHOOK_TOKEN  — the shared secret configured on the webhook in the
 *                            Moyasar dashboard.
 *
 * With either missing the webhook route refuses every request, which is the
 * right posture for an endpoint that hands out subscriptions.
 */

import { timingSafeEqualStr } from './crypto'
import { YEARLY_PRICE } from './payment'

export const MOYASAR_API = 'https://api.moyasar.com/v1'

/** What one paid subscription buys. Matches updateBakerySubscription('activate'). */
export const SUBSCRIPTION_DAYS = 365

/** Moyasar works in halalas — 2,500 SAR is 250,000, not 2,500. */
export const expectedAmountHalalas = () => Math.round(YEARLY_PRICE * 100)

export interface MoyasarConfig {
  secretKey: string
  webhookToken: string
}

/** null when the gateway is not configured — the caller must treat that as "off", not "open". */
export function moyasarConfig(): MoyasarConfig | null {
  const secretKey = process.env.MOYASAR_SECRET_KEY?.trim()
  const webhookToken = process.env.MOYASAR_WEBHOOK_TOKEN?.trim()
  if (!secretKey || !webhookToken) return null
  return { secretKey, webhookToken }
}

/**
 * Constant-time comparison of the webhook's shared token.
 *
 * An empty or missing token never passes, even against an empty configured
 * value — moyasarConfig() already rejects that case, but a `===` here would
 * make an unset variable an open door.
 */
export function verifyWebhookToken(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false
  return timingSafeEqualStr(provided, expected)
}

export interface MoyasarPayment {
  id: string
  status: string
  amount: number
  currency: string
  metadata: Record<string, unknown> | null
  refunded?: number
  source?: { type?: string; company?: string } | null
}

/**
 * Discriminated on a string rather than a boolean `ok`: the test build compiles
 * with strictNullChecks off, where a boolean discriminant does not narrow.
 */
export type LookupResult =
  | { kind: 'ok'; payment: MoyasarPayment }
  | { kind: 'not_found' }
  /** Moyasar was unreachable or answered 5xx — retryable, so the caller must not decide anything. */
  | { kind: 'unavailable' }

/**
 * Reads a payment straight from Moyasar.
 *
 * This is the whole security model: the webhook body only supplies the id, and
 * the amount, currency, status and metadata all come from the response here.
 * A forged body can therefore claim nothing — at worst it names a real payment,
 * which is already recorded and cannot be applied twice.
 */
export async function fetchMoyasarPayment(id: string, cfg: MoyasarConfig): Promise<LookupResult> {
  const auth = Buffer.from(`${cfg.secretKey}:`).toString('base64')

  let res: Response
  try {
    res = await fetch(`${MOYASAR_API}/payments/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    console.error('[moyasar] lookup failed', e)
    return { kind: 'unavailable' }
  }

  if (res.status === 404) return { kind: 'not_found' }
  if (!res.ok) {
    console.error('[moyasar] lookup returned', res.status)
    // 401 means our own key is wrong. That is an outage on our side, not a
    // reason to conclude the payment is fake.
    return { kind: 'unavailable' }
  }

  try {
    const body: any = await res.json()
    if (!body || typeof body.id !== 'string') return { kind: 'unavailable' }
    return {
      kind: 'ok',
      payment: {
        id: body.id,
        status: String(body.status ?? ''),
        amount: Number(body.amount ?? 0),
        currency: String(body.currency ?? ''),
        metadata: body.metadata ?? null,
        refunded: Number(body.refunded ?? 0),
        source: body.source ?? null,
      },
    }
  } catch (e) {
    console.error('[moyasar] unreadable response', e)
    return { kind: 'unavailable' }
  }
}

export type Rejection =
  | 'not_paid'
  | 'refunded'
  | 'wrong_currency'
  | 'wrong_amount'
  | 'no_bakery'

export type Verdict =
  | { kind: 'accept'; bakeryId: string }
  | { kind: 'reject'; reason: Rejection }

/**
 * Everything that must be true of a verified payment before it buys a year.
 *
 * Returns the bakery it belongs to, or the reason it does not count. Kept apart
 * from the route so each rule can be tested on its own.
 */
export function evaluatePayment(p: MoyasarPayment): Verdict {
  if (p.status !== 'paid') return { kind: 'reject', reason: 'not_paid' }
  if ((p.refunded ?? 0) > 0) return { kind: 'reject', reason: 'refunded' }
  if (p.currency.toUpperCase() !== 'SAR') return { kind: 'reject', reason: 'wrong_currency' }

  // Exact, not "at least". An amount we did not price is a misconfigured
  // payment link or a tampered checkout, and either way a human should look at
  // it before a subscription starts.
  if (p.amount !== expectedAmountHalalas()) return { kind: 'reject', reason: 'wrong_amount' }

  const bakeryId = typeof p.metadata?.bakery_id === 'string' ? p.metadata.bakery_id.trim() : ''
  if (!bakeryId) return { kind: 'reject', reason: 'no_bakery' }

  return { kind: 'accept', bakeryId }
}
