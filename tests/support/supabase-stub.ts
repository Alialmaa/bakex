/**
 * Stands in for lib/supabase.ts while the tests run.
 *
 * scripts/test.mjs copies the compiled version of this file over
 * .test-build/lib/supabase.js, so every module under test gets this
 * `supabaseAdmin` without knowing it. That is why this file imports nothing
 * relative: after the copy its own path has changed and any relative import
 * would break.
 *
 * Fixtures and the call log live on globalThis for the same reason —
 * tests/support/db.ts reaches the same object from its own location.
 */

interface StubDb {
  tables: Record<string, any[]>
  rpc: Record<string, (args: any) => any>
  /** Force a failure. Keys look like `users:select` or `rpc:sales_revenue`. */
  errors: Record<string, string>
  calls: { kind: string; target: string; at: number; args?: any }[]
  /** Milliseconds each call takes, so parallel and sequential work is tellable apart. */
  latencyMs: number
}

function store(): StubDb {
  const g = globalThis as any
  if (!g.__bakexDb) {
    g.__bakexDb = { tables: {}, rpc: {}, errors: {}, calls: [], latencyMs: 0 }
  }
  return g.__bakexDb
}

const wait = (ms: number) => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve())

type Filter = { op: 'eq' | 'gte' | 'lte' | 'neq'; col: string; val: any }

function applyFilters(rows: any[], filters: Filter[]) {
  return rows.filter(row =>
    filters.every(f => {
      const v = row[f.col]
      if (f.op === 'eq') return v === f.val
      if (f.op === 'neq') return v !== f.val
      if (f.op === 'gte') return v >= f.val
      return v <= f.val
    })
  )
}

function builder(table: string, kind: 'select' | 'insert' | 'update' | 'delete', payload?: any, opts?: any) {
  const db = store()
  const filters: Filter[] = []
  let limit: number | null = null
  let orderBy: { col: string; asc: boolean } | null = null

  const run = async (mode: 'many' | 'single') => {
    db.calls.push({ kind, target: table, at: Date.now() })
    await wait(db.latencyMs)

    const err = db.errors[`${table}:${kind}`]
    if (err) return { data: null, error: { message: err }, count: null }

    const rows = db.tables[table] ?? (db.tables[table] = [])

    if (kind === 'insert') {
      const added = (Array.isArray(payload) ? payload : [payload]).map((r, i) => ({ id: `gen-${table}-${rows.length + i}`, ...r }))
      rows.push(...added)
      return { data: mode === 'single' ? added[0] : added, error: null, count: added.length }
    }
    if (kind === 'update') {
      const hit = applyFilters(rows, filters)
      hit.forEach(r => Object.assign(r, payload))
      return { data: mode === 'single' ? hit[0] ?? null : hit, error: null, count: hit.length }
    }
    if (kind === 'delete') {
      const doomed = new Set(applyFilters(rows, filters))
      db.tables[table] = rows.filter(r => !doomed.has(r))
      return { data: null, error: null, count: doomed.size }
    }

    let out = applyFilters(rows, filters)
    if (orderBy) {
      out = [...out].sort((a, b) => {
        const x = a[orderBy!.col], y = b[orderBy!.col]
        return (x > y ? 1 : x < y ? -1 : 0) * (orderBy!.asc ? 1 : -1)
      })
    }
    if (limit !== null) out = out.slice(0, limit)

    // .select('*', { count: 'exact', head: true }) asks only for the tally.
    if (opts?.head) return { data: null, error: null, count: out.length }
    return { data: mode === 'single' ? out[0] ?? null : out, error: null, count: out.length }
  }

  const api: any = {
    select: (_cols?: string, o?: any) => { if (o) opts = { ...opts, ...o }; return api },
    eq: (col: string, val: any) => { filters.push({ op: 'eq', col, val }); return api },
    neq: (col: string, val: any) => { filters.push({ op: 'neq', col, val }); return api },
    gte: (col: string, val: any) => { filters.push({ op: 'gte', col, val }); return api },
    lte: (col: string, val: any) => { filters.push({ op: 'lte', col, val }); return api },
    order: (col: string, o?: { ascending?: boolean }) => { orderBy = { col, asc: o?.ascending !== false }; return api },
    limit: (n: number) => { limit = n; return api },
    single: () => run('single'),
    maybeSingle: () => run('single'),
    then: (resolve: any, reject: any) => run('many').then(resolve, reject),
  }
  return api
}

export const supabaseAdmin = {
  from: (table: string) => ({
    select: (cols?: string, opts?: any) => builder(table, 'select', undefined, opts).select(cols, opts),
    insert: (rows: any) => builder(table, 'insert', rows),
    update: (patch: any) => builder(table, 'update', patch),
    delete: () => builder(table, 'delete'),
  }),

  rpc: async (fn: string, args: any) => {
    const db = store()
    db.calls.push({ kind: 'rpc', target: fn, at: Date.now(), args })
    await wait(db.latencyMs)
    const err = db.errors[`rpc:${fn}`]
    if (err) return { data: null, error: { message: err } }
    const handler = db.rpc[fn]
    if (!handler) return { data: null, error: { message: `no stub for rpc ${fn}` } }
    return { data: handler(args), error: null }
  },
}
