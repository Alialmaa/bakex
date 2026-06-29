import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { listBakeries, createBakery, getBakeryUserCount } from '../../../lib/db/bakeries'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
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
    res.status(405).end()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
