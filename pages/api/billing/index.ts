import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { checkBakeryAccess } from '../../../lib/subscription'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res, { skipSubscription: true })
  if (!user) return

  if (isSuperAdmin(user)) return res.status(200).json({ status: 'super_admin', allowed: true, daysLeft: null })
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  if (req.method === 'GET') {
    const access = await checkBakeryAccess(user.bakery_id)
    return res.status(200).json(access)
  }

  // Self-service activation is deliberately absent.
  //
  // This route used to accept POST {action:'activate'} and grant a year of
  // subscription to any admin who asked — with no payment verification of any
  // kind. Payment is collected out-of-band (bank transfer), so activation is
  // a super-admin action: PATCH /api/bakeries {id, action:'activate'}.
  //
  // Do not reintroduce a self-service path here without a payment provider
  // whose webhook signature is verified server-side.
  res.status(405).end()
}
