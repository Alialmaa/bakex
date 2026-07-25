import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../lib/auth'
import { listProduction, updateProductionEntry, deleteProductionEntry } from '../../lib/db/production'
import { apiError } from '../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listProduction(bakery_id, req.query.date as string))
    }
    if (req.method === 'PUT') {
      if (!user.perms?.produce && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      const { id, output_qty } = req.body
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' })
      if (typeof output_qty !== 'number' || output_qty <= 0 || !Number.isFinite(output_qty))
        return res.status(400).json({ error: 'output_qty must be a positive number' })
      await updateProductionEntry(id, bakery_id, output_qty)
      return res.status(200).json({ success: true })
    }
    if (req.method === 'DELETE') {
      if (!user.perms?.produce && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })
      await deleteProductionEntry(req.body.id, bakery_id)
      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    return apiError(res, e, 'production')
  }
}
