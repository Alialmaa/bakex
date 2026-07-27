import type { NextApiRequest, NextApiResponse } from 'next'
import { requirePerm } from '../../../lib/auth'
import { createUser } from '../../../lib/db/users'
import { apiError } from '../../../lib/apiError'
import { requirePassword } from '../../../lib/validate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requirePerm(req, res, 'users')
  if (!user) return
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { name, username, password, role, perms } = req.body
  if (!name || !username || !password)
    return res.status(400).json({ error: 'Missing fields' })
  if (typeof name !== 'string' || name.length > 100)
    return res.status(400).json({ error: 'name must be at most 100 characters' })
  if (typeof username !== 'string' || username.length > 50)
    return res.status(400).json({ error: 'username must be at most 50 characters' })
  const pwErr = requirePassword(password)
  if (pwErr) return res.status(400).json({ error: pwErr })

  const ALLOWED_ROLES = ['staff', 'manager', 'readonly']
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'staff'

  const ALLOWED_PERMS = ['dashboard', 'stock', 'produce', 'sales', 'cost', 'reports', 'users']
  const safePerms: Record<string, boolean> = {}
  if (perms && typeof perms === 'object') {
    for (const key of ALLOWED_PERMS) {
      if (key in perms) safePerms[key] = Boolean(perms[key])
    }
  }

  try {
    const data = await createUser({
      name, username, password,
      role: safeRole,
      perms: safePerms,
      bakery_id: user.bakery_id,
      status: 'active',
    })
    res.status(200).json({ success: true, user: data })
  } catch (e: any) {
    if (e.message === 'Username already taken') return res.status(409).json({ error: e.message })
    return apiError(res, e, 'users.create')
  }
}
