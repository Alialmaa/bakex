import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('bakeries')
      .select('id,name,code,vat_number,cr_number,address,city,phone,business_type')
      .eq('id', bakery_id)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin' && !user.perms?.users) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { name, vat_number, cr_number, address, city, phone, business_type } = req.body
    const { data, error } = await supabaseAdmin
      .from('bakeries')
      .update({ name, vat_number, cr_number, address, city, phone, business_type })
      .eq('id', bakery_id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).end()
}
