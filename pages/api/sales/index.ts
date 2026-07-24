import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listSales, createSales, deleteSale } from '../../../lib/db/sales'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      const { from, to } = req.query
      return res.status(200).json(await listSales(bakery_id, from as string, to as string))
    }
    if (req.method === 'POST') {
      if (!user.perms?.sales && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { entries, date } = req.body
      if (!Array.isArray(entries) || entries.length === 0)
        return res.status(400).json({ error: 'entries must be a non-empty array' })
      for (const e of entries) {
        if (!e || typeof e.recipe_id !== 'string' || !e.recipe_id)
          return res.status(400).json({ error: 'Each entry must have a valid recipe_id' })
        if (typeof e.qty !== 'number' || e.qty <= 0 || !Number.isFinite(e.qty))
          return res.status(400).json({ error: 'Each entry must have a positive qty' })
        if (typeof e.unit_price !== 'number' || e.unit_price < 0 || !Number.isFinite(e.unit_price))
          return res.status(400).json({ error: 'Each entry must have a non-negative unit_price' })
      }
      return res.status(200).json(await createSales(bakery_id, entries, user.id, date))
    }
    if (req.method === 'DELETE') {
      if (!user.perms?.sales && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      await deleteSale(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
