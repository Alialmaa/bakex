import { supabaseAdmin } from './supabase'

export async function logAudit(opts: {
  bakery_id: string
  actor_id: string
  actor_name?: string
  action: string
  target_type: string
  target_id?: string
  details?: object
}) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      bakery_id: opts.bakery_id,
      actor_id: opts.actor_id,
      actor_name: opts.actor_name || null,
      action: opts.action,
      target_type: opts.target_type,
      target_id: opts.target_id || null,
      details: opts.details || {},
    })
  } catch (e) {
    // Audit logging must never break the actual request.
    console.error('Audit log write failed:', e)
  }
}
