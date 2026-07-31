import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, isSuperAdmin } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'
import { listStock } from '../../../lib/db/stock'
import { apiError } from '../../../lib/apiError'
import { logAudit } from '../../../lib/audit'
import { MAX_IMPORT_ROWS } from '../../../lib/importStock'

/**
 * Bulk import of materials.
 *
 * The browser has already parsed the sheet and shown the user a preview, and
 * none of that is evidence: what arrives here is an array a caller composed,
 * so every row is validated again and every column is named explicitly. A
 * spread of the client's object would be a write into every column of `stock`,
 * including ones this route has no business setting.
 *
 * Existing materials are matched by name, which is what the unique index on
 * (bakery_id, name) already enforces. `mode` decides what happens to them:
 * `update` overwrites quantity, minimum and price; `skip` leaves them alone and
 * only adds what is new. Nothing is ever deleted — an import is not a sync.
 */

type Mode = 'update' | 'skip'

interface CleanRow {
  name: string
  unit: string
  qty: number
  min_qty: number
  price_per_unit: number
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireAuth(req, res)
  if (!user) return
  const bakery_id = user.bakery_id
  if (!bakery_id) return res.status(403).json({ error: 'No bakery assigned' })
  if (!user.perms?.stock && !isSuperAdmin(user)) return res.status(403).json({ error: 'Forbidden' })

  const body: any = req.body ?? {}
  const mode: Mode = body.mode === 'skip' ? 'skip' : 'update'

  if (!Array.isArray(body.rows)) return res.status(400).json({ error: 'rows must be an array' })
  if (body.rows.length === 0) return res.status(400).json({ error: 'nothing to import' })
  if (body.rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `too many rows (max ${MAX_IMPORT_ROWS})` })
  }

  // Rebuilt field by field, and collapsed by name again: the unique index would
  // otherwise reject the whole batch because of one repeated row.
  const byName = new Map<string, CleanRow>()
  for (const raw of body.rows) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 200) : ''
    if (!name) continue
    byName.set(name, {
      name,
      unit: typeof raw?.unit === 'string' ? raw.unit.trim().slice(0, 50) : '',
      qty: num(raw?.qty),
      min_qty: num(raw?.min_qty),
      price_per_unit: num(raw?.price_per_unit),
    })
  }

  const rows = Array.from(byName.values())
  if (rows.length === 0) return res.status(400).json({ error: 'no row had a name' })

  try {
    const existing = await listStock(bakery_id)
    const existingByName = new Map<string, any>((existing || []).map((s: any) => [s.name, s]))

    const toInsert = rows.filter(r => !existingByName.has(r.name))
    const toUpdate = mode === 'update' ? rows.filter(r => existingByName.has(r.name)) : []
    const skipped = rows.length - toInsert.length - toUpdate.length

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('stock').insert(
        toInsert.map(r => ({
          bakery_id,
          name: r.name,
          unit: r.unit,
          qty: r.qty,
          min_qty: r.min_qty,
          price_per_unit: r.price_per_unit,
        }))
      )
      if (error) throw error
    }

    // One statement per changed material rather than a bulk upsert: an upsert
    // would need the client to send ids, and matching on name here keeps the
    // route unable to touch a row in another bakery whatever it is sent.
    for (const r of toUpdate) {
      const { error } = await supabaseAdmin
        .from('stock')
        .update({ unit: r.unit, qty: r.qty, min_qty: r.min_qty, price_per_unit: r.price_per_unit })
        .eq('bakery_id', bakery_id)
        .eq('name', r.name)
      if (error) throw error
    }

    await logAudit({
      bakery_id,
      actor_id: user.id,
      actor_name: user.name,
      action: 'stock.import',
      target_type: 'stock',
      details: { mode, added: toInsert.length, updated: toUpdate.length, skipped },
    })

    return res.status(200).json({
      added: toInsert.length,
      updated: toUpdate.length,
      skipped,
      total: rows.length,
    })
  } catch (e) {
    return apiError(res, e, 'stock.import')
  }
}
