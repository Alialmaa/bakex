import { supabaseAdmin } from './supabase'

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'unknown'

export type SubscriptionAccess = {
  allowed: boolean
  daysLeft: number
  status: SubscriptionStatus
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
}

// 1-minute per-bakery cache — avoids a DB hit on every API request
const _cache = new Map<string, SubscriptionAccess & { t: number }>()
const CACHE_TTL = 60_000

export async function checkBakeryAccess(bakery_id: string): Promise<SubscriptionAccess> {
  const now = Date.now()
  const hit = _cache.get(bakery_id)
  if (hit && now - hit.t < CACHE_TTL) {
    const { t: _, ...rest } = hit
    return rest
  }

  try {
    const { data } = await supabaseAdmin
      .from('bakeries')
      .select('subscription_status, trial_ends_at, subscription_ends_at')
      .eq('id', bakery_id)
      .single()

    if (!data) return { allowed: false, daysLeft: 0, status: 'unknown', trialEndsAt: null, subscriptionEndsAt: null }

    const rawStatus = data.subscription_status || 'trial'
    let allowed = false
    let daysLeft = 0

    if (rawStatus === 'trial' && data.trial_ends_at) {
      const msLeft = new Date(data.trial_ends_at).getTime() - now
      daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000))
      allowed = daysLeft > 0
    } else if (rawStatus === 'active' && data.subscription_ends_at) {
      const msLeft = new Date(data.subscription_ends_at).getTime() - now
      daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000))
      allowed = daysLeft > 0
    } else if (!data.trial_ends_at && !data.subscription_status) {
      // Rows predating the subscription columns: treat as a fresh trial rather
      // than as unlimited access.
      allowed = true
      daysLeft = 30
    }

    const status: SubscriptionStatus = allowed ? rawStatus as SubscriptionStatus : 'expired'
    const result: SubscriptionAccess = {
      allowed, daysLeft, status,
      trialEndsAt: data.trial_ends_at ?? null,
      subscriptionEndsAt: data.subscription_ends_at ?? null,
    }
    _cache.set(bakery_id, { ...result, t: now })
    return result
  } catch (e) {
    // A read failure is not a licence. Serve the last known answer if we have
    // one, even expired, and otherwise allow the request through for a short
    // grace period so an outage does not lock out paying customers — but never
    // mint a fresh 30-day trial out of an error.
    console.error('[subscription] lookup failed', e)
    const stale = _cache.get(bakery_id)
    if (stale) { const { t: _, ...rest } = stale; return rest }
    return { allowed: true, daysLeft: 0, status: 'unknown', trialEndsAt: null, subscriptionEndsAt: null }
  }
}

export function invalidateSubscriptionCache(bakery_id: string) {
  _cache.delete(bakery_id)
}
