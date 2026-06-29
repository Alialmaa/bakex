import { supabaseAdmin } from '../supabase'

export async function listBakeries() {
  const { data, error } = await supabaseAdmin
    .from('bakeries')
    .select('id, name, code, created_at')
    .order('created_at')
  if (error) throw error
  return data
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
  const { data, error } = await supabaseAdmin
    .from('bakeries')
    .insert({ name, code })
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
