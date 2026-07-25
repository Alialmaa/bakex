import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listPurchases, createPurchase, deletePurchase } from '../../../lib/db/purchases'
import { requireString, requirePositiveNumber } from '../../../lib/validate'
import { apiError } from '../../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listPurchases(bakery_id))
    }
    if (req.method === 'POST') {
      if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { material_name, qty, unit, pack_weight, pack_price, price_per_unit, notes } = req.body
      const err = requireString(material_name, 'material_name')
        || requirePositiveNumber(qty, 'qty')
        || requirePositiveNumber(price_per_unit, 'price_per_unit')
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(
        await createPurchase(bakery_id, user.id, { material_name, qty, unit, pack_weight, pack_price, price_per_unit, notes })
      )
    }
    if (req.method === 'DELETE') {
      if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      await deletePurchase(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    return apiError(res, e, 'purchases')
  }
}
