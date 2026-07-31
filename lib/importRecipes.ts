import { toSheet, parseNumber, normaliseHeader, type Sheet } from './csvParse'
import { MAX_INGREDIENTS } from './validate'

/**
 * Turning a recipe book into recipes.
 *
 * A recipe is not one row: it has a list of ingredients, and a flat sheet
 * cannot nest. The shape people already keep theirs in is the long one — a row
 * per ingredient, with the recipe's name repeated down the column:
 *
 *   الوصفة | المكوّن | الكمية | عدد الوحدات | سعر البيع
 *   كرواسون | دقيق   | 500    | 20          | 12
 *   كرواسون | زبدة   | 250    |             |
 *   كيك     | دقيق   | 300    | 10          | 6.5
 *
 * The recipe-level columns are read from the first row of each recipe that
 * fills them in, because that is how the sheet is written: once at the top of
 * the block, blank on the rows beneath.
 *
 * The one check that matters more than the parsing: an ingredient naming a
 * material that is not in stock costs **zero**. lib/reports.ts multiplies each
 * ingredient by the stock price and skips what it cannot find, so a typo in a
 * material name does not fail — it silently understates that recipe's cost, its
 * profit, and every total built on it. Those are surfaced here before anything
 * is saved.
 */

export const RECIPE_FIELDS = [
  'recipe', 'material', 'amount', 'units_per_batch', 'output_unit', 'sell_price',
] as const
export type RecipeField = (typeof RECIPE_FIELDS)[number]

export const MAX_IMPORT_RECIPES = 500

export const RECIPE_FIELD_LABELS: Record<RecipeField, { ar: string; en: string }> = {
  recipe:          { ar: 'الوصفة',       en: 'Recipe' },
  material:        { ar: 'المكوّن',       en: 'Ingredient' },
  amount:          { ar: 'الكمية',        en: 'Amount' },
  units_per_batch: { ar: 'عدد الوحدات',  en: 'Units per batch' },
  output_unit:     { ar: 'وحدة الإخراج', en: 'Output unit' },
  sell_price:      { ar: 'سعر البيع',    en: 'Sell price' },
}

/** Matched after normaliseHeader folds alef, ta-marbuta and diacritics. */
const SYNONYMS: Record<RecipeField, string[]> = {
  recipe: ['الوصفه', 'وصفه', 'اسم الوصفه', 'المنتج', 'منتج', 'اسم المنتج', 'الصنف',
           'recipe', 'product', 'item', 'dish'],
  material: ['المكون', 'مكون', 'المكونات', 'الماده', 'ماده', 'الخامه', 'المادة الخام',
             'ingredient', 'material', 'component', 'raw material'],
  amount: ['الكميه', 'كميه', 'المقدار', 'مقدار', 'الوزن', 'وزن',
           'amount', 'qty', 'quantity', 'weight'],
  units_per_batch: ['عدد الوحدات', 'الوحدات', 'الانتاج', 'ينتج', 'الناتج', 'عدد القطع',
                    'الكميه المنتجه', 'units', 'units per batch', 'yield', 'output', 'batch', 'pieces'],
  output_unit: ['وحده الاخراج', 'وحده المنتج', 'وحده الناتج', 'الوحده',
                'output unit', 'unit', 'uom'],
  sell_price: ['سعر البيع', 'السعر', 'سعر', 'البيع', 'سعر بيع',
               'price', 'sell price', 'selling price', 'retail'],
}

const POSITIONAL: RecipeField[] = ['recipe', 'material', 'amount', 'units_per_batch', 'sell_price']

export type RecipeMapping = Partial<Record<RecipeField, number>>

export function detectRecipeMapping(header: string[]): RecipeMapping {
  const mapping: RecipeMapping = {}
  if (header.length === 0) {
    POSITIONAL.forEach((f, i) => { mapping[f] = i })
    return mapping
  }

  const normalised = header.map(normaliseHeader)
  const taken = new Set<number>()

  const claim = (field: RecipeField, test: (h: string, syn: string) => boolean) => {
    if (mapping[field] !== undefined) return
    for (let i = 0; i < normalised.length; i++) {
      if (taken.has(i) || !normalised[i]) continue
      if (SYNONYMS[field].some(syn => test(normalised[i], syn))) {
        mapping[field] = i
        taken.add(i)
        return
      }
    }
  }

  // Exact before partial, so "سعر البيع" is not claimed by the "الوحدة" rule
  // and "وحدة الإخراج" is not claimed by "الكمية".
  for (const f of RECIPE_FIELDS) claim(f, (h, syn) => h === syn)
  for (const f of RECIPE_FIELDS) claim(f, (h, syn) => h.includes(syn) || syn.includes(h))

  if (mapping.recipe === undefined) {
    const free = normalised.findIndex((_, i) => !taken.has(i))
    if (free >= 0) { mapping.recipe = free; taken.add(free) }
  }
  if (mapping.material === undefined) {
    const free = normalised.findIndex((_, i) => !taken.has(i))
    if (free >= 0) mapping.material = free
  }
  return mapping
}

export interface RecipeIssue {
  line: number
  recipe?: string
  field?: RecipeField
  message: string
}

export interface ParsedIngredient { material: string; amount: number }

export interface ParsedRecipe {
  name: string
  units_per_batch: number
  output_unit: string
  sell_price: number
  ingredients: ParsedIngredient[]
  /** Lines in the user's sheet that fed this recipe, for pointing at problems. */
  lines: number[]
}

export interface RecipePreview {
  sheet: Sheet
  mapping: RecipeMapping
  recipes: ParsedRecipe[]
  issues: RecipeIssue[]
  /**
   * Ingredient names with no matching material in stock. These cost zero and
   * are the single most expensive thing to get wrong in this file.
   */
  unknownMaterials: string[]
  truncated: boolean
}

const cell = (row: string[], i: number | undefined) =>
  i === undefined || i < 0 || i >= row.length ? '' : (row[i] ?? '').trim()

export function buildRecipePreview(
  input: string,
  knownMaterials: string[] = [],
  override?: RecipeMapping,
  delimiter?: string
): RecipePreview {
  const sheet = toSheet(input, delimiter)
  const mapping = { ...detectRecipeMapping(sheet.header), ...(override ?? {}) }
  const headerOffset = sheet.header.length > 0 ? 2 : 1

  const issues: RecipeIssue[] = []
  const byName = new Map<string, ParsedRecipe>()
  const known = new Set(knownMaterials.map(m => m.trim()))
  const unknown = new Set<string>()
  let truncated = false

  sheet.rows.forEach((raw, i) => {
    const line = i + headerOffset
    const name = cell(raw, mapping.recipe).slice(0, 200)

    if (!name) {
      issues.push({ line, field: 'recipe', message: 'لا يوجد اسم للوصفة' })
      return
    }

    let recipe = byName.get(name)
    if (!recipe) {
      if (byName.size >= MAX_IMPORT_RECIPES) { truncated = true; return }
      recipe = { name, units_per_batch: 0, output_unit: '', sell_price: 0, ingredients: [], lines: [] }
      byName.set(name, recipe)
    }
    recipe.lines.push(line)

    // Recipe-level columns are written once at the top of a block and left
    // blank underneath, so the first row that fills one in wins and later
    // blanks never erase it.
    if (!recipe.units_per_batch) {
      const n = parseNumber(cell(raw, mapping.units_per_batch))
      if (n !== null && n > 0) recipe.units_per_batch = n
    }
    if (!recipe.sell_price) {
      const n = parseNumber(cell(raw, mapping.sell_price))
      if (n !== null && n > 0) recipe.sell_price = n
    }
    if (!recipe.output_unit) {
      const u = cell(raw, mapping.output_unit).slice(0, 50)
      if (u) recipe.output_unit = u
    }

    // A row may carry only the recipe-level values — a header line for the
    // block with no ingredient of its own. That is not an error.
    const material = cell(raw, mapping.material).slice(0, 200)
    const rawAmount = cell(raw, mapping.amount)
    if (!material && !rawAmount) return

    if (!material) {
      issues.push({ line, recipe: name, field: 'material', message: 'كمية بلا مكوّن' })
      return
    }

    const amount = parseNumber(rawAmount)
    if (amount === null) {
      issues.push({
        line, recipe: name, field: 'amount',
        message: rawAmount ? `"${rawAmount}" ليست كمية` : 'لا توجد كمية للمكوّن',
      })
      return
    }
    if (amount <= 0) {
      issues.push({ line, recipe: name, field: 'amount', message: 'الكمية يجب أن تكون أكبر من صفر' })
      return
    }

    if (recipe.ingredients.length >= MAX_INGREDIENTS) {
      issues.push({
        line, recipe: name,
        message: `تجاوزت ${MAX_INGREDIENTS} مكوّن — تم تجاهل الباقي`,
      })
      return
    }

    // The same material twice in one recipe is almost always two lines of the
    // same thing rather than a mistake, so the amounts are added.
    const existing = recipe.ingredients.find(g => g.material === material)
    if (existing) existing.amount += amount
    else recipe.ingredients.push({ material, amount })

    if (known.size > 0 && !known.has(material)) unknown.add(material)
  })

  for (const r of Array.from(byName.values())) {
    if (r.ingredients.length === 0) {
      issues.push({ line: r.lines[0], recipe: r.name, message: 'وصفة بلا مكوّنات' })
    }
    // A batch that makes nothing would divide its cost by zero. createRecipe
    // already falls back to 1, and 1 is the honest reading of a sheet that does
    // not say — one batch, one unit.
    if (!r.units_per_batch) r.units_per_batch = 1
    if (!r.output_unit) r.output_unit = 'حبة'
  }

  if (truncated) {
    issues.push({ line: 0, message: `تم أخذ أول ${MAX_IMPORT_RECIPES} وصفة فقط` })
  }

  return {
    sheet,
    mapping,
    recipes: Array.from(byName.values()).filter(r => r.ingredients.length > 0),
    issues,
    unknownMaterials: Array.from(unknown),
    truncated,
  }
}
