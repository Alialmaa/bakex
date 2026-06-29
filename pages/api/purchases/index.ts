import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listPurchases, createPurchase, deletePurchase } from '../../../lib/db/purchases'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listPurchases(bakery_id))
    }
    if (req.method === 'POST') {
      const { material_name, qty, unit, pack_weight, pack_price, price_per_unit, notes } = req.body
      return res.status(200).json(
        await createPurchase(bakery_id, user.id, { material_name, qty, unit, pack_weight, pack_price, price_per_unit, notes })
      )
    }
    if (req.method === 'DELETE') {
      await deletePurchase(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
