import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  if (!user.bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  const { id, barcode, mode } = req.body
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' })
  if (typeof barcode !== 'string' || !barcode.trim()) return res.status(400).json({ error: 'barcode is required' })
  if (mode !== 'stock' && mode !== 'recipe') return res.status(400).json({ error: 'mode must be stock or recipe' })

  const table = mode === 'stock' ? 'stock' : 'recipes'
  const { error } = await supabaseAdmin
    .from(table)
    .update({ barcode: barcode.trim() })
    .eq('id', id)
    .eq('bakery_id', user.bakery_id)

  if (error) return apiError(res, error, 'scanner.assign')
  return res.status(200).json({ success: true })
}
