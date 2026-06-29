// Small validation helpers for API routes. Return an error string, or null if valid.

export function requireString(value: unknown, field: string, opts: { min?: number; max?: number } = {}): string | null {
  if (typeof value !== 'string' || !value.trim()) return `${field} is required`
  if (opts.min !== undefined && value.trim().length < opts.min) return `${field} must be at least ${opts.min} characters`
  if (opts.max !== undefined && value.trim().length > opts.max) return `${field} must be at most ${opts.max} characters`
  return null
}

export function requireNonNegativeNumber(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null // optional fields use DB defaults
  const n = typeof value === 'number' ? value : NaN
  if (typeof value !== 'number' || Number.isNaN(n) || !Number.isFinite(n) || n < 0) {
    return `${field} must be a non-negative number`
  }
  return null
}

export function requirePositiveNumber(value: unknown, field: string): string | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    return `${field} must be a positive number`
  }
  return null
}
