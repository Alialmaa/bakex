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

export const MAX_INGREDIENTS = 100

/**
 * Validates a recipe's ingredient list.
 *
 * `amount` in particular has to be a real, finite number. A non-numeric amount
 * used to flow into the produce endpoint, where `mat.qty < ing.amount * batches`
 * compares against NaN — which is always false, so the stock check passed — and
 * the subtraction that followed wrote NaN into the quantity, corrupting the row
 * and everything computed from it.
 */
export function requireIngredients(value: unknown, field = 'ingredients'): string | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return `${field} must be an array`
  if (value.length > MAX_INGREDIENTS) return `${field} must contain at most ${MAX_INGREDIENTS} entries`

  for (let i = 0; i < value.length; i++) {
    const ing: any = value[i]
    if (!ing || typeof ing !== 'object' || Array.isArray(ing))
      return `${field}[${i}] must be an object`
    if (typeof ing.material !== 'string' || !ing.material.trim())
      return `${field}[${i}].material is required`
    if (ing.material.length > 200)
      return `${field}[${i}].material is too long`
    if (typeof ing.amount !== 'number' || !Number.isFinite(ing.amount) || ing.amount <= 0)
      return `${field}[${i}].amount must be a positive number`
  }
  return null
}

/** Keeps only the fields a recipe ingredient is allowed to carry. */
export function normaliseIngredients(value: unknown): { material: string; amount: number }[] {
  if (!Array.isArray(value)) return []
  return value.map((i: any) => ({ material: String(i.material).trim(), amount: i.amount }))
}
