import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listBakeries, createBakery, getBakeryUserCount, updateBakerySubscription, updateBakeryAccessCode } from '../../../lib/db/bakeries'
import { invalidateSubscriptionCache } from '../../../lib/subscription'
import { apiError } from '../../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Super admin only' })

  try {
    if (req.method === 'GET') {
      const bakeries = await listBakeries()
      const withCounts = await Promise.all(
        bakeries.map(async (b: any) => ({
          ...b,
          user_count: await getBakeryUserCount(b.id),
        }))
      )
      return res.status(200).json(withCounts)
    }
    if (req.method === 'POST') {
      const { name } = req.body
      if (!name) return res.status(400).json({ error: 'Name required' })
      return res.status(200).json(await createBakery(name))
    }
    if (req.method === 'PATCH') {
      const { id, action, access_code } = req.body
      if (!id) return res.status(400).json({ error: 'id required' })
      if (action === 'set_access_code') {
        const code = typeof access_code === 'string' ? access_code.trim() || null : null
        await updateBakeryAccessCode(id, code)
        return res.status(200).json({ success: true })
      }
      if (!['activate', 'extend_trial', 'expire'].includes(action))
        return res.status(400).json({ error: 'invalid action' })
      await updateBakerySubscription(id, action)
      invalidateSubscriptionCache(id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    return apiError(res, e, 'bakeries')
  }
}
