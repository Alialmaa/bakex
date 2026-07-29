import { supabaseAdmin } from './supabase'

export async function logAudit(opts: {
  bakery_id: string
  /** Null for entries no user made — the payment webhook, for one. */
  actor_id: string | null
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
    // A logging failure must never break the request that caused it — but it
    // must also not pass unnoticed. Swallowing this quietly meant a missing
    // audit_log table looked exactly like a working audit trail.
    const missingTable = /relation .*audit_log.* does not exist|could not find the table/i
      .test((e as any)?.message ?? '')
    if (missingTable) {
      console.error(
        '[audit] CRITICAL: the audit_log table is missing, so no audit entry is being ' +
        'recorded. Apply migrations/003_missing_objects.sql.'
      )
    } else {
      console.error('[audit] write failed:', e)
    }
  }
}
