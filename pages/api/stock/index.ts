import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listStock, addStockItem, updateStockItem, deleteStockItem } from '../../../lib/db/stock'
import { requireString, requireNonNegativeNumber } from '../../../lib/validate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listStock(bakery_id))
    }
    if (req.method === 'POST') {
      const { name, qty, unit, min_qty, price_per_unit } = req.body
      const err = requireString(name, 'name')
        || requireNonNegativeNumber(qty, 'qty')
        || requireNonNegativeNumber(min_qty, 'min_qty')
        || requireNonNegativeNumber(price_per_unit, 'price_per_unit')
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await addStockItem(bakery_id, { name, qty, unit, min_qty, price_per_unit }))
    }
    if (req.method === 'PUT') {
      const { id, qty, min_qty, price_per_unit } = req.body
      const err = requireString(id, 'id')
        || requireNonNegativeNumber(qty, 'qty')
        || requireNonNegativeNumber(min_qty, 'min_qty')
        || requireNonNegativeNumber(price_per_unit, 'price_per_unit')
      if (err) return res.status(400).json({ error: err })
      return res.status(200).json(await updateStockItem(id, bakery_id, { qty, min_qty, price_per_unit }))
    }
    if (req.method === 'DELETE') {
      await deleteStockItem(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
