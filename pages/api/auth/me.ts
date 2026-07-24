import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  res.status(200).json({ user })
}
