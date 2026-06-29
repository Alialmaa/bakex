import type { NextApiRequest, NextApiResponse } from 'next'
import { requirePerm } from '../../../lib/auth'
import { listUsers, updateUser, deleteUser } from '../../../lib/db/users'
import { logAudit } from '../../../lib/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requirePerm(req, res, 'users')
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listUsers(bakery_id))
    }
    if (req.method === 'PUT') {
      const { id, role, perms, status } = req.body
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' })

      await updateUser(id, bakery_id, { role, perms, status })

      await logAudit({
        bakery_id, actor_id: user.id, actor_name: user.name,
        action: status === 'active' && role ? 'user.approve' : status === 'rejected' ? 'user.reject' : 'user.update',
        target_type: 'user', target_id: id, details: { role, perms, status },
      })

      return res.status(200).json({ success: true })
    }
    if (req.method === 'DELETE') {
      const { id } = req.body
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' })

      await deleteUser(id, bakery_id)

      await logAudit({
        bakery_id, actor_id: user.id, actor_name: user.name,
        action: 'user.delete', target_type: 'user', target_id: id,
      })

      return res.status(200).json({ success: true })
    }
    res.status(405).end()
  } catch (e: any) {
    const status = e.message === 'Cannot delete admin' ? 403 : e.message === 'User not found' ? 404 : 500
    res.status(status).json({ error: e.message })
  }
}
