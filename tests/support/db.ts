/**
 * The tests' handle on the stubbed database.
 *
 * The accessor is written out again here rather than imported from
 * supabase-stub.ts: that file gets copied to a different directory before the
 * tests run, so the two cannot share a relative import. They meet on globalThis
 * instead.
 */

export interface StubDb {
  tables: Record<string, any[]>
  rpc: Record<string, (args: any) => any>
  errors: Record<string, string>
  calls: { kind: string; target: string; at: number; args?: any }[]
  latencyMs: number
}

export function db(): StubDb {
  const g = globalThis as any
  if (!g.__bakexDb) {
    g.__bakexDb = { tables: {}, rpc: {}, errors: {}, calls: [], latencyMs: 0 }
  }
  return g.__bakexDb
}

/** Clears fixtures, stubs, injected errors and the call log. */
export function resetDb() {
  const d = db()
  d.tables = {}
  d.rpc = {}
  d.errors = {}
  d.calls = []
  d.latencyMs = 0
}

export const seed = (table: string, rows: any[]) => { db().tables[table] = rows }
export const onRpc = (fn: string, handler: (args: any) => any) => { db().rpc[fn] = handler }
export const failWith = (key: string, message = 'stubbed failure') => { db().errors[key] = message }
export const calls = () => db().calls
export const callsTo = (target: string) => db().calls.filter(c => c.target === target)

/** Makes every call take `ms`, so overlapping work is distinguishable from sequential. */
export const setLatency = (ms: number) => { db().latencyMs = ms }

export const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
