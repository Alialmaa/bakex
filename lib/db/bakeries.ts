import { supabaseAdmin } from '../supabase'
import { generateCode } from '../crypto'

export async function listBakeries() {
  const { data, error } = await supabaseAdmin
    .from('bakeries')
    .select('id, name, code, access_code, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .order('created_at')
  if (error) throw error
  return data
}

export async function updateBakeryAccessCode(id: string, access_code: string | null) {
  const { error } = await supabaseAdmin.from('bakeries').update({ access_code }).eq('id', id)
  if (error) throw error
}

export async function updateBakerySubscription(
  id: string,
  action: 'activate' | 'extend_trial' | 'expire'
) {
  const now = Date.now()
  let patch: Record<string, unknown>

  if (action === 'activate') {
    patch = {
      subscription_status: 'active',
      subscription_ends_at: new Date(now + 365 * 86_400_000).toISOString(),
    }
  } else if (action === 'extend_trial') {
    patch = {
      subscription_status: 'trial',
      trial_ends_at: new Date(now + 30 * 86_400_000).toISOString(),
      subscription_ends_at: null,
    }
  } else {
    patch = {
      subscription_status: 'expired',
      trial_ends_at: new Date(now - 1).toISOString(),
      subscription_ends_at: null,
    }
  }

  const { error } = await supabaseAdmin.from('bakeries').update(patch).eq('id', id)
  if (error) throw error
}

export async function getBakeryByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from('bakeries')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  if (error) return null
  return data
}

export async function createBakery(name: string) {
  const code = generateCode()
  const trial_ends_at = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('bakeries')
    .insert({ name, code, trial_ends_at, subscription_status: 'trial' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBakeryUserCount(bakery_id: string) {
  const { count } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('bakery_id', bakery_id)
  return count ?? 0
}

/**
 * User counts for every bakery, in one query.
 *
 * The bakeries page called getBakeryUserCount() once per row, so the super
 * admin's list cost one round trip per bakery — 101 queries at 100 customers,
 * and it gets slower with every signup. One narrow column for every user is a
 * few hundred small rows even at that size.
 */
export async function getBakeryUserCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('users').select('bakery_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of (data as { bakery_id: string | null }[]) || []) {
    if (!row.bakery_id) continue
    counts[row.bakery_id] = (counts[row.bakery_id] ?? 0) + 1
  }
  return counts
}
