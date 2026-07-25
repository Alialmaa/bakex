import { supabaseAdmin } from '../supabase'

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

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
