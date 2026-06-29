import type { NextApiRequest, NextApiResponse } from 'next'
import { requirePerm } from '../../../lib/auth'
import { createUser } from '../../../lib/db/users'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requirePerm(req, res, 'users')
  if (!user) return
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { name, username, password, role, perms } = req.body
  if (!name || !username || !password)
    return res.status(400).json({ error: 'Missing fields' })

  try {
    const data = await createUser({
      name, username, password,
      role: role || 'staff',
      perms: perms || {},
      bakery_id: user.bakery_id,
      status: 'active',
    })
    res.status(200).json({ success: true, user: data })
  } catch (e: any) {
    const status = e.message === 'Username already taken' ? 409 : 500
    res.status(status).json({ error: e.message })
  }
}
