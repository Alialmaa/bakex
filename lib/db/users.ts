import { supabaseAdmin } from '../supabase'
import { hashPassword } from '../auth'

export async function getUserByUsername(username: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('username', username)
    .single()
  return data
}

export async function listUsers(bakery_id: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, username, role, perms, status, created_at')
    .eq('bakery_id', bakery_id)
    .order('created_at')
  if (error) throw error
  return data
}

export async function listPendingUsers(bakery_id: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, username, role, perms, status, created_at')
    .eq('bakery_id', bakery_id)
    .eq('status', 'pending')
    .order('created_at')
  if (error) throw error
  return data
}

export async function countPendingUsers(bakery_id: string | null) {
  let q = supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  if (bakery_id) q = q.eq('bakery_id', bakery_id)
  const { count } = await q
  return count ?? 0
}

export async function updateUser(id: string, bakery_id: string, update: {
  role?: string; perms?: object; status?: string
}) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(update)
    .eq('id', id)
    .eq('bakery_id', bakery_id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('User not found')
}

export async function deleteUser(id: string, bakery_id: string) {
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', id)
    .eq('bakery_id', bakery_id)
    .maybeSingle()
  if (!target) throw new Error('User not found')
  if (target.role === 'admin') throw new Error('Cannot delete admin')
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', id)
    .eq('bakery_id', bakery_id)
  if (error) throw error
}

export async function createUser(params: {
  name: string; username: string; password: string
  role: string; perms: object; bakery_id: string; status: string
}) {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', params.username)
    .single()
  if (existing) throw new Error('Username already taken')

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      name: params.name,
      username: params.username,
      password_hash: hashPassword(params.password),
      role: params.role,
      perms: params.perms,
      bakery_id: params.bakery_id,
      status: params.status,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function requestUser(params: {
  name: string; username: string; password: string; bakery_id: string
}) {
  return createUser({ ...params, role: 'staff', perms: {}, status: 'pending' })
}
