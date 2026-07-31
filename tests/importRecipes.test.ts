import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db, resetDb, seed } from './support/db'
import { signToken, invalidateUserCache } from '../lib/auth'
import { invalidateSubscriptionCache } from '../lib/subscription'
import { buildRecipePreview, detectRecipeMapping, MAX_IMPORT_RECIPES } from '../lib/importRecipes'
import { MAX_INGREDIENTS } from '../lib/validate'
import handler from '../pages/api/recipes/import'

/**
 * A recipe is not one row, so the sheet is read in long form and grouped. The
 * costly failure is not a parse error: an ingredient naming a material that is
 * not in stock costs zero, and buildReport skips what it cannot find — so a
 * typo silently understates that recipe's cost and every figure above it.
 * Catching those before anything is saved is most of the point.
 */

const SHEET = [
  'الوصفة,المكوّن,الكمية,عدد الوحدات,سعر البيع',
  'كرواسون,دقيق,500,20,12',
  'كرواسون,زبدة,250,,',
  'كيك,دقيق,300,10,6.5',
  'كيك,سكر,200,,',
].join('\n')

const MATERIALS = ['دقيق', 'زبدة', 'سكر']

describe('detectRecipeMapping', () => {
  test('finds every column of an Arabic header', () => {
    const m = detectRecipeMapping(['الوصفة', 'المكوّن', 'الكمية', 'عدد الوحدات', 'سعر البيع'])
    assert.deepEqual(m, { recipe: 0, material: 1, amount: 2, units_per_batch: 3, sell_price: 4 })
  })

  test('finds an English header in any order', () => {
    const m = detectRecipeMapping(['Amount', 'Ingredient', 'Recipe', 'Yield', 'Price'])
    assert.equal(m.recipe, 2)
    assert.equal(m.material, 1)
    assert.equal(m.amount, 0)
    assert.equal(m.units_per_batch, 3)
    assert.equal(m.sell_price, 4)
  })

  test('"سعر البيع" is not claimed by the unit rule', () => {
    const m = detectRecipeMapping(['الوصفة', 'المكوّن', 'الكمية', 'وحدة الإخراج', 'سعر البيع'])
    assert.equal(m.output_unit, 3)
    assert.equal(m.sell_price, 4)
  })

  test('a headerless sheet is read positionally', () => {
    assert.deepEqual(detectRecipeMapping([]),
      { recipe: 0, material: 1, amount: 2, units_per_batch: 3, sell_price: 4 })
  })

  test('an unrecognised header still gets a recipe and a material column', () => {
    const m = detectRecipeMapping(['Rezept', 'Zutat', 'Menge'])
    assert.equal(m.recipe, 0)
    assert.equal(m.material, 1)
  })
})

describe('buildRecipePreview', () => {
  test('groups the rows into recipes with their ingredients', () => {
    const p = buildRecipePreview(SHEET, MATERIALS)
    assert.equal(p.recipes.length, 2)
    const croissant = p.recipes.find(r => r.name === 'كرواسون')!
    assert.deepEqual(croissant.ingredients, [
      { material: 'دقيق', amount: 500 },
      { material: 'زبدة', amount: 250 },
    ])
  })

  test('takes the recipe-level figures from the first row that fills them in', () => {
    // They are written once at the top of a block and left blank underneath.
    const p = buildRecipePreview(SHEET, MATERIALS)
    const croissant = p.recipes.find(r => r.name === 'كرواسون')!
    assert.equal(croissant.units_per_batch, 20)
    assert.equal(croissant.sell_price, 12)
  })

  test('a later blank never erases a figure already read', () => {
    const p = buildRecipePreview([
      'الوصفة,المكوّن,الكمية,عدد الوحدات',
      'كيك,دقيق,300,10',
      'كيك,سكر,200,',
    ].join('\n'), MATERIALS)
    assert.equal(p.recipes[0].units_per_batch, 10)
  })

  test('a batch that says nothing makes one unit, not zero', () => {
    // Zero would divide the cost by zero and take every figure with it.
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nخبز,دقيق,1000', MATERIALS)
    assert.equal(p.recipes[0].units_per_batch, 1)
    assert.equal(p.recipes[0].output_unit, 'حبة')
  })

  test('names the ingredients that are not in stock', () => {
    // These cost zero and nothing downstream complains.
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,دقيق,300\nكيك,فانيليا,5', MATERIALS)
    assert.deepEqual(p.unknownMaterials, ['فانيليا'])
  })

  test('checks nothing when it has no stock list to check against', () => {
    const p = buildRecipePreview(SHEET, [])
    assert.deepEqual(p.unknownMaterials, [])
  })

  test('the same material twice in one recipe is added up', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,دقيق,300\nكيك,دقيق,200', MATERIALS)
    assert.equal(p.recipes[0].ingredients.length, 1)
    assert.equal(p.recipes[0].ingredients[0].amount, 500)
  })

  test('reads Arabic-Indic digits and separators like the materials import', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية,عدد الوحدات,سعر البيع\nكيك,دقيق,٣٠٠,١٠,"6,50"', MATERIALS)
    assert.equal(p.recipes[0].ingredients[0].amount, 300)
    assert.equal(p.recipes[0].units_per_batch, 10)
    assert.equal(p.recipes[0].sell_price, 6.5)
  })

  test('a row with no recipe name is reported', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\n,دقيق,300', MATERIALS)
    assert.equal(p.recipes.length, 0)
    assert.equal(p.issues[0].field, 'recipe')
  })

  test('an unreadable amount is an error, and the ingredient is left out', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,دقيق,كثير\nكيك,سكر,200', MATERIALS)
    assert.equal(p.recipes[0].ingredients.length, 1)
    assert.ok(p.issues.some(i => i.field === 'amount' && i.recipe === 'كيك'))
  })

  test('an amount of zero is refused — an ingredient of nothing is not one', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,دقيق,0\nكيك,سكر,200', MATERIALS)
    assert.equal(p.recipes[0].ingredients.length, 1)
    assert.ok(p.issues.some(i => i.field === 'amount'))
  })

  test('a row carrying only the batch figures is not an error', () => {
    const p = buildRecipePreview([
      'الوصفة,المكوّن,الكمية,عدد الوحدات',
      'كيك,,,10',
      'كيك,دقيق,300,',
    ].join('\n'), MATERIALS)
    assert.equal(p.issues.length, 0)
    assert.equal(p.recipes[0].units_per_batch, 10)
    assert.equal(p.recipes[0].ingredients.length, 1)
  })

  test('a recipe with no ingredients at all is reported and dropped', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,,\nخبز,دقيق,100', MATERIALS)
    assert.deepEqual(p.recipes.map(r => r.name), ['خبز'])
    assert.ok(p.issues.some(i => i.recipe === 'كيك'))
  })

  test('reports the line number as it appears in the sheet', () => {
    const p = buildRecipePreview('الوصفة,المكوّن,الكمية\nكيك,دقيق,300\nكيك,سكر,سيئ', MATERIALS)
    assert.equal(p.issues[0].line, 3)
  })

  test('stops at the ingredient cap rather than sending a recipe the API will reject', () => {
    const rows = ['الوصفة,المكوّن,الكمية']
    for (let i = 0; i < MAX_INGREDIENTS + 10; i++) rows.push(`كيك,مادة${i},1`)
    const p = buildRecipePreview(rows.join('\n'), [])
    assert.equal(p.recipes[0].ingredients.length, MAX_INGREDIENTS)
    assert.ok(p.issues.length > 0)
  })

  test('caps the number of recipes and says so', () => {
    const rows = ['الوصفة,المكوّن,الكمية']
    for (let i = 0; i < MAX_IMPORT_RECIPES + 5; i++) rows.push(`وصفة${i},دقيق,1`)
    const p = buildRecipePreview(rows.join('\n'), [])
    assert.equal(p.truncated, true)
    assert.equal(p.recipes.length, MAX_IMPORT_RECIPES)
  })

  test('pasted tab-separated cells work exactly like a file', () => {
    const p = buildRecipePreview('الوصفة\tالمكوّن\tالكمية\nكيك\tدقيق\t300', MATERIALS)
    assert.equal(p.recipes[0].ingredients[0].amount, 300)
  })

  test('empty input is an empty preview, not a crash', () => {
    const p = buildRecipePreview('', MATERIALS)
    assert.deepEqual(p.recipes, [])
    assert.deepEqual(p.issues, [])
  })
})

// ─── the route ──────────────────────────────────────────────

const ADMIN = {
  id: 'u-admin', token_version: 1, status: 'active',
  role: 'admin', perms: { stock: true }, bakery_id: 'b1', name: 'علي',
}

const token = (over: any = {}) => signToken({
  id: ADMIN.id, tv: ADMIN.token_version, role: ADMIN.role,
  perms: ADMIN.perms, bakery_id: ADMIN.bakery_id, ...over,
})

function mock(body: any, method = 'POST', tok = token()) {
  const req: any = { method, headers: { cookie: `bakex_token=${tok}` }, body, query: {} }
  const res: any = {
    code: 200, body: null, headers: {},
    status(c: number) { res.code = c; return res },
    json(b: any) { res.body = b; return res },
    end() { return res },
    setHeader(k: string, v: any) { res.headers[k] = v; return res },
  }
  return { req, res }
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

beforeEach(() => {
  resetDb()
  invalidateUserCache(ADMIN.id)
  invalidateSubscriptionCache('b1')
  seed('users', [{ ...ADMIN }])
  seed('bakeries', [{ id: 'b1', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: daysFromNow(90) }])
  seed('recipes', [{
    id: 'r1', bakery_id: 'b1', name: 'كيك', units_per_batch: 10, output_qty: 10,
    output_unit: 'حبة', sell_price: 6.5, ingredients: [{ material: 'دقيق', amount: 300 }],
  }])
  seed('audit_log', [])
})

const RECIPE = (over: any = {}) => ({
  name: 'كرواسون', units_per_batch: 20, output_unit: 'حبة', sell_price: 12,
  ingredients: [{ material: 'دقيق', amount: 500 }, { material: 'زبدة', amount: 250 }],
  ...over,
})

describe('POST /api/recipes/import', () => {
  test('adds a recipe that is new', async () => {
    const { req, res } = mock({ recipes: [RECIPE()] })
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.deepEqual(res.body, { added: 1, updated: 0, skipped: 0, total: 1 })
    const saved = db().tables['recipes'].find((r: any) => r.name === 'كرواسون')
    assert.equal(saved.units_per_batch, 20)
    assert.equal(saved.bakery_id, 'b1')
    assert.equal(saved.ingredients.length, 2)
  })

  test('keeps output_qty in step with units_per_batch, as the hand-typed path does', async () => {
    const { req, res } = mock({ recipes: [RECIPE()] })
    await handler(req, res)
    const saved = db().tables['recipes'].find((r: any) => r.name === 'كرواسون')
    assert.equal(saved.output_qty, saved.units_per_batch)
  })

  test('overwrites an existing recipe in update mode', async () => {
    const { req, res } = mock({
      recipes: [RECIPE({ name: 'كيك', units_per_batch: 25, sell_price: 9,
        ingredients: [{ material: 'سكر', amount: 100 }] })],
    })
    await handler(req, res)
    assert.deepEqual(res.body, { added: 0, updated: 1, skipped: 0, total: 1 })
    const cake = db().tables['recipes'].find((r: any) => r.name === 'كيك')
    assert.equal(cake.units_per_batch, 25)
    assert.deepEqual(cake.ingredients, [{ material: 'سكر', amount: 100 }])
  })

  test('skip mode leaves an existing recipe alone', async () => {
    const { req, res } = mock({ mode: 'skip', recipes: [RECIPE({ name: 'كيك', units_per_batch: 99 })] })
    await handler(req, res)
    assert.deepEqual(res.body, { added: 0, updated: 0, skipped: 1, total: 1 })
    assert.equal(db().tables['recipes'].find((r: any) => r.name === 'كيك').units_per_batch, 10)
  })

  test('never deletes: a recipe absent from the file survives', async () => {
    const { req, res } = mock({ recipes: [RECIPE()] })
    await handler(req, res)
    assert.ok(db().tables['recipes'].some((r: any) => r.name === 'كيك'))
  })

  test('refuses an ingredient amount that is not a positive number', async () => {
    // This is the value that reached the produce endpoint, where the stock
    // check compared against NaN — always false — and then wrote NaN into qty.
    for (const bad of ['كثير', null, 0, -5, NaN, Infinity]) {
      const { req, res } = mock({ recipes: [RECIPE({ ingredients: [{ material: 'دقيق', amount: bad }] })] })
      await handler(req, res)
      assert.equal(res.code, 400, String(bad))
    }
  })

  test('refuses an ingredient with no material name', async () => {
    const { req, res } = mock({ recipes: [RECIPE({ ingredients: [{ material: '   ', amount: 5 }] })] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('refuses more ingredients than a recipe may hold', async () => {
    const ingredients = Array.from({ length: MAX_INGREDIENTS + 1 }, (_, i) => ({ material: `م${i}`, amount: 1 }))
    const { req, res } = mock({ recipes: [RECIPE({ ingredients })] })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('keeps only the fields a recipe is allowed to carry', async () => {
    const { req, res } = mock({
      recipes: [RECIPE({
        bakery_id: 'someone-else', id: 'forged',
        ingredients: [{ material: 'دقيق', amount: 500, cost: 999, note: 'x' }],
      })],
    })
    await handler(req, res)
    const saved = db().tables['recipes'].find((r: any) => r.name === 'كرواسون')
    assert.equal(saved.bakery_id, 'b1', 'the bakery comes from the session')
    assert.deepEqual(saved.ingredients, [{ material: 'دقيق', amount: 500 }])
  })

  test('clamps a batch size and a price rather than storing them', async () => {
    const { req, res } = mock({ recipes: [RECIPE({ units_per_batch: 1e12, sell_price: 1e12 })] })
    await handler(req, res)
    const saved = db().tables['recipes'].find((r: any) => r.name === 'كرواسون')
    assert.equal(saved.units_per_batch, 1_000_000)
    assert.equal(saved.sell_price, 1_000_000)
  })

  test('rejects a body that is not a list of recipes', async () => {
    for (const bad of [{}, { recipes: 'كيك' }, { recipes: [] }]) {
      const { req, res } = mock(bad)
      await handler(req, res)
      assert.equal(res.code, 400, JSON.stringify(bad))
    }
  })

  test('rejects a batch past the cap', async () => {
    const recipes = Array.from({ length: MAX_IMPORT_RECIPES + 1 }, (_, i) => RECIPE({ name: `و${i}` }))
    const { req, res } = mock({ recipes })
    await handler(req, res)
    assert.equal(res.code, 400)
  })

  test('a user without the stock permission cannot import', async () => {
    invalidateUserCache('u-view')
    seed('users', [{ ...ADMIN }, { id: 'u-view', token_version: 1, status: 'active', role: 'readonly', perms: { stock: false }, bakery_id: 'b1' }])
    const { req, res } = mock({ recipes: [RECIPE()] }, 'POST',
      signToken({ id: 'u-view', tv: 1, role: 'readonly', perms: { stock: false }, bakery_id: 'b1' }))
    await handler(req, res)
    assert.equal(res.code, 403)
    assert.ok(!db().tables['recipes'].some((r: any) => r.name === 'كرواسون'))
  })

  test('GET is not a way in', async () => {
    const { req, res } = mock({ recipes: [] }, 'GET')
    await handler(req, res)
    assert.equal(res.code, 405)
  })

  test('leaves an audit entry saying what it did', async () => {
    const { req, res } = mock({ recipes: [RECIPE(), RECIPE({ name: 'كيك' })] })
    await handler(req, res)
    const entry = db().tables['audit_log'][0]
    assert.equal(entry.action, 'recipes.import')
    assert.equal(entry.details.added, 1)
    assert.equal(entry.details.updated, 1)
  })

  test('a sheet parsed in the browser survives the round trip intact', async () => {
    const preview = buildRecipePreview(SHEET, MATERIALS)
    const { req, res } = mock({ recipes: preview.recipes })
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(res.body.added, 1)
    assert.equal(res.body.updated, 1)
    const croissant = db().tables['recipes'].find((r: any) => r.name === 'كرواسون')
    assert.equal(croissant.sell_price, 12)
    assert.deepEqual(croissant.ingredients, [
      { material: 'دقيق', amount: 500 },
      { material: 'زبدة', amount: 250 },
    ])
  })
})
