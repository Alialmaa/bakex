import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, clearAuthCookie, invalidateUserCache } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Clearing the cookie only removes the browser's copy. The token itself stayed
  // valid for the rest of its 8h life, so a copy captured beforehand — a shared
  // terminal, a synced browser profile — kept working after "log out". Bumping
  // token_version revokes it for real.
  const user = getUser(req)
  if (user?.id) {
    try {
      const { data } = await supabaseAdmin
        .from('users').select('token_version').eq('id', user.id).single()
      if (data) {
        await supabaseAdmin
          .from('users')
          .update({ token_version: (data.token_version ?? 0) + 1 })
          .eq('id', user.id)
      }
      invalidateUserCache(user.id)
    } catch {
      // Signing out must still succeed if the database is unreachable; the
      // cookie is cleared below either way.
    }
  }

  clearAuthCookie(res)
  res.status(200).json({ success: true })
}
