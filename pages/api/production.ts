import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../lib/auth'
import { listProduction, updateProductionEntry, deleteProductionEntry } from '../../lib/db/production'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listProduction(bakery_id, req.query.date as string))
    }
    if (req.method === 'PUT') {
      const { id, output_qty } = req.body
      await updateProductionEntry(id, bakery_id, output_qty)
      return res.status(200).json({ success: true })
    }
    if (req.method === 'DELETE') {
      await deleteProductionEntry(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
