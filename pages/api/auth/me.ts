import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser } from '../../../lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getUser(req as any)
  if (!user) return res.status(401).json({ error: 'Not logged in' })
  res.status(200).json({ user })
}
