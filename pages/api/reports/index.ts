import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { buildReport } from '../../../lib/reports'
import { apiError } from '../../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id && !isSuperAdmin(user)) return res.status(403).json({ error: 'No bakery assigned' })
  if (!user.perms?.reports && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })

  try {
    // Same builder the page's getServerSideProps uses, so the 30-second refresh
    // cannot replace the rendered figures with a differently-defined set — and
    // the range travels with the request, so a refresh cannot quietly snap the
    // period back to the current month either.
    return res.status(200).json(await buildReport(bakery_id, req.query))
  } catch (e) {
    return apiError(res, e, 'reports')
  }
}
