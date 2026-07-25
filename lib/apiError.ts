import type { NextApiResponse } from 'next'

/**
 * Logs the real error and returns a generic message.
 *
 * Routes used to answer `{ error: e.message }` on failure, handing back raw
 * Postgres text — table names, column names, constraint names. Feeding an
 * endpoint deliberately malformed input mapped out the schema for free, which
 * is the first step of any serious attempt on the database.
 */
export function apiError(res: NextApiResponse, err: unknown, context: string) {
  console.error(`[${context}]`, err)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
