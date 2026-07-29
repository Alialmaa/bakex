import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { invalidateSubscriptionCache } from '../../../lib/subscription'
import { logAudit } from '../../../lib/audit'
import {
  moyasarConfig, verifyWebhookToken, fetchMoyasarPayment, evaluatePayment, SUBSCRIPTION_DAYS,
} from '../../../lib/moyasar'

/**
 * The only path that can start a subscription without a human.
 *
 * Nothing in the request body is trusted except the payment id, and that only
 * as a lookup key. The order matters:
 *
 *   1. shared token, constant-time — cheap, and it keeps a stranger from
 *      making us call Moyasar's API on demand;
 *   2. read the payment back from Moyasar by id — the amount, currency, status
 *      and bakery all come from that response, never from the POST;
 *   3. the payment must be paid, unrefunded, in SAR, for exactly our price,
 *      and carry a bakery_id in its metadata;
 *   4. apply_subscription_payment() records it and extends the subscription in
 *      one transaction, and does nothing at all the second time the same
 *      payment id arrives.
 *
 * Status codes are chosen for what the gateway does with them: 5xx means
 * "we failed, retry", 2xx means "heard you" — including for a payment we
 * deliberately refuse to act on, because retrying that forever helps nobody.
 * A refusal is logged loudly instead.
 */

/** True when the reason needs someone to look at it, not just a log line. */
const ALARMING = new Set(['wrong_amount', 'unknown_payment', 'unknown_bakery', 'no_bakery'])

function ignore(res: NextApiResponse, reason: string, detail?: unknown) {
  if (ALARMING.has(reason)) {
    console.error(`[moyasar] REFUSED payment (${reason}) — needs a human`, detail ?? '')
  } else {
    console.log(`[moyasar] ignored webhook (${reason})`)
  }
  return res.status(200).json({ ok: true, ignored: reason })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cfg = moyasarConfig()
  if (!cfg) {
    console.error('[moyasar] webhook hit while MOYASAR_SECRET_KEY / MOYASAR_WEBHOOK_TOKEN are unset')
    return res.status(503).json({ error: 'Payments are not configured' })
  }

  const body: any = req.body ?? {}
  const provided = req.headers['x-moyasar-token'] ?? body.secret_token
  if (!verifyWebhookToken(Array.isArray(provided) ? provided[0] : provided, cfg.webhookToken)) {
    // No detail in the response: a caller probing tokens learns nothing beyond
    // "not this one".
    console.warn('[moyasar] webhook rejected: bad token')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // `body.id` is the event's id; the payment's lives under `data`.
  const raw = body?.data?.id ?? body?.id
  const paymentId = typeof raw === 'string' ? raw.trim() : ''
  if (!paymentId || paymentId.length > 128) {
    return res.status(400).json({ error: 'Missing payment id' })
  }

  const lookup = await fetchMoyasarPayment(paymentId, cfg)
  // Unreachable is our problem — answer 5xx so the gateway delivers it again.
  if (lookup.kind === 'unavailable') return res.status(502).json({ error: 'Lookup failed' })
  // Moyasar has never heard of this id, so somebody made the request up.
  if (lookup.kind === 'not_found') return ignore(res, 'unknown_payment', paymentId)

  const payment = lookup.payment
  const verdict = evaluatePayment(payment)
  if (verdict.kind === 'reject') {
    return ignore(res, verdict.reason, { id: payment.id, amount: payment.amount, currency: payment.currency })
  }

  const { data, error } = await supabaseAdmin.rpc('apply_subscription_payment', {
    p_provider: 'moyasar',
    p_payment_id: payment.id,
    p_bakery_id: verdict.bakeryId,
    p_amount_halalas: payment.amount,
    p_currency: payment.currency.toUpperCase(),
    p_days: SUBSCRIPTION_DAYS,
  })

  if (error) {
    // Money has already left the customer's card. Fail loudly and let the
    // gateway retry rather than swallowing it.
    console.error('[moyasar] apply_subscription_payment failed', payment.id, error)
    return res.status(500).json({ error: 'Could not apply payment' })
  }

  const result: any = data ?? {}
  if (result.duplicate) {
    // The expected outcome of every retry and every replay.
    return res.status(200).json({ ok: true, duplicate: true })
  }
  if (!result.applied) {
    return ignore(res, result.reason || 'not_applied', { id: payment.id, bakery: verdict.bakeryId })
  }

  invalidateSubscriptionCache(verdict.bakeryId)

  await logAudit({
    bakery_id: verdict.bakeryId,
    actor_id: null,
    actor_name: 'Moyasar webhook',
    action: 'subscription.activate',
    target_type: 'bakery',
    target_id: verdict.bakeryId,
    details: {
      provider: 'moyasar',
      payment_id: payment.id,
      amount_halalas: payment.amount,
      currency: payment.currency,
      days: SUBSCRIPTION_DAYS,
      ends_at: result.ends_at ?? null,
    },
  })

  console.log(`[moyasar] activated ${verdict.bakeryId} from payment ${payment.id} until ${result.ends_at}`)
  return res.status(200).json({ ok: true, applied: true })
}
