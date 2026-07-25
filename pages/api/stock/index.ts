import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listStock, addStockItem, updateStockItem, deleteStockItem } from '../../../lib/db/stock'
import { requireString, requireNonNegativeNumber } from '../../../lib/validate'
import { apiError } from '../../../lib/apiError'
import { logAudit } from '../../../lib/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listStock(bakery_id))
    }
    if (req.method === 'POST') {
      if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { name, qty, unit, min_qty, price_per_unit } = req.body
      const err = requireString(name, 'name', { max: 200 })
        || (unit !== undefined ? requireString(unit, 'unit', { max: 50 }) : null)
        || requireNonNegativeNumber(qty, 'qty')
        || requireNonNegativeNumber(min_qty, 'min_qty')
        || requireNonNegativeNumber(price_per_unit, 'price_per_unit')
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await addStockItem(bakery_id, { name, qty, unit, min_qty, price_per_unit }))
    }
    if (req.method === 'PUT') {
      if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { id, qty, min_qty, price_per_unit } = req.body
      const err = requireString(id, 'id')
        || requireNonNegativeNumber(qty, 'qty')
        || requireNonNegativeNumber(min_qty, 'min_qty')
        || requireNonNegativeNumber(price_per_unit, 'price_per_unit')
      if (err) return res.status(400).json({ error: err })
      const updated = await updateStockItem(id, bakery_id, { qty, min_qty, price_per_unit })
      await logAudit({ bakery_id, actor_id: user.id, actor_name: user.name,
        action: 'stock.update', target_type: 'stock', target_id: id,
        details: { qty, min_qty, price_per_unit } })
      return res.status(200).json(updated)
    }
    if (req.method === 'DELETE') {
      if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      await deleteStockItem(req.body.id, bakery_id)
      await logAudit({ bakery_id, actor_id: user.id, actor_name: user.name,
        action: 'stock.delete', target_type: 'stock', target_id: req.body.id })
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    return apiError(res, e, 'stock')
  }
}
