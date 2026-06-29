import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listSales, createSales, deleteSale } from '../../../lib/db/sales'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      const { from, to } = req.query
      return res.status(200).json(await listSales(bakery_id, from as string, to as string))
    }
    if (req.method === 'POST') {
      const { entries, date } = req.body
      return res.status(200).json(await createSales(bakery_id, entries, user.id, date))
    }
    if (req.method === 'DELETE') {
      await deleteSale(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
