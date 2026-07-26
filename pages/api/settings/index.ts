import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'

/** Editable fields, with the maximum length each accepts. */
const EDITABLE: Record<string, number> = {
  name: 200,
  business_type: 100,
  phone: 20,
  city: 100,
  address: 300,
  vat_number: 15,
  cr_number: 10,
}

const ADMIN_ONLY = ['vat_number', 'cr_number']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('bakeries')
      .select('id,name,code,vat_number,cr_number,address,city,phone,business_type')
      .eq('id', bakery_id)
      .single()
    if (error) return apiError(res, error, 'settings')
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin' && !user.perms?.users) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const body = req.body ?? {}

    // The form posts every field on every save, so an admin-only field being
    // present is not itself an attempt to change it — compare before refusing.
    const { data: current } = await supabaseAdmin
      .from('bakeries')
      .select('name,vat_number,cr_number,address,city,phone,business_type')
      .eq('id', bakery_id)
      .single()

    const patch: Record<string, string | null> = {}
    for (const [field, max] of Object.entries(EDITABLE)) {
      if (body[field] === undefined) continue

      // The VAT and commercial registration numbers are the business's tax
      // identity: they appear on every invoice and in its QR code. Anyone
      // holding the `users` permission could rewrite them; only the owner
      // should be able to.
      const submitted = typeof body[field] === 'string' ? body[field].trim() : body[field]
      const stored = (current as any)?.[field] ?? null
      const changed = (submitted || null) !== (stored || null)
      if (changed && ADMIN_ONLY.includes(field) && user.role !== 'admin') {
        return res.status(403).json({ error: `Only the owner can change ${field}` })
      }

      const value = body[field]
      if (value !== null && typeof value !== 'string') {
        return res.status(400).json({ error: `${field} must be text` })
      }
      const trimmed = value === null ? null : value.trim()
      if (trimmed && trimmed.length > max) {
        return res.status(400).json({ error: `${field} must be at most ${max} characters` })
      }
      patch[field] = trimmed || null
    }

    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })
    if (patch.name === null) return res.status(400).json({ error: 'name is required' })

    const { data, error } = await supabaseAdmin
      .from('bakeries')
      .update(patch)
      .eq('id', bakery_id)
      .select()
      .single()
    if (error) return apiError(res, error, 'settings')
    return res.status(200).json(data)
  }

  res.status(405).end()
}
