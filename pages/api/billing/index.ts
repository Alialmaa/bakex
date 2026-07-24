import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { checkBakeryAccess, invalidateSubscriptionCache } from '../../../lib/subscription'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res, { skipSubscription: true })
  if (!user) return

  if (isSuperAdmin(user)) return res.status(200).json({ status: 'super_admin', allowed: true, daysLeft: null })
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  if (req.method === 'GET') {
    const access = await checkBakeryAccess(user.bakery_id)
    return res.status(200).json(access)
  }

  // POST — activate subscription (called after successful payment)
  if (req.method === 'POST') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const { action } = req.body
    if (action !== 'activate') return res.status(400).json({ error: 'Unknown action' })

    const subscription_ends_at = new Date(Date.now() + 365 * 86_400_000).toISOString()
    const { error } = await supabaseAdmin
      .from('bakeries')
      .update({ subscription_status: 'active', subscription_ends_at })
      .eq('id', user.bakery_id)

    if (error) return res.status(500).json({ error: error.message })

    invalidateSubscriptionCache(user.bakery_id)
    return res.status(200).json({ success: true, subscription_ends_at })
  }

  res.status(405).end()
}
