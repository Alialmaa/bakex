import { useMemo, useRef, useState } from 'react'
import {
  buildRecipePreview, RECIPE_FIELDS, RECIPE_FIELD_LABELS,
  type RecipeMapping,
} from '../lib/importRecipes'

/**
 * Bringing a recipe book in from a spreadsheet.
 *
 * Same two ways in as the materials import — a `.csv` or cells pasted from
 * Excel — but the sheet is read in long form: one row per ingredient, with the
 * recipe's name repeated down its block.
 *
 * The screen this shows is mostly about one thing. An ingredient whose material
 * is not in stock costs zero, and nothing downstream complains: the recipe's
 * cost, its margin and every report built on it are simply understated. So the
 * unknown materials are the loudest thing in the dialog, above the recipes
 * themselves.
 */

const GREEN = '#16a679'

export default function ImportRecipes({
  lang, materials, existingNames, onClose, onDone,
}: {
  lang: string
  materials: string[]
  existingNames: string[]
  onClose: () => void
  onDone: (result: { added: number; updated: number; skipped: number }) => void
}) {
  const isAR = lang === 'ar'
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [override, setOverride] = useState<RecipeMapping>({})
  const [mode, setMode] = useState<'update' | 'skip'>('update')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(
    () => (text.trim() ? buildRecipePreview(text, materials, override) : null),
    [text, materials, override]
  )

  const existing = useMemo(() => new Set(existingNames), [existingNames])
  const counts = useMemo(() => {
    if (!preview) return { add: 0, update: 0 }
    let add = 0, update = 0
    for (const r of preview.recipes) (existing.has(r.name) ? update++ : add++)
    return { add, update }
  }, [preview, existing])

  const readFile = async (file: File) => {
    setError('')
    if (file.size > 4_000_000) {
      setError(isAR ? 'الملف كبير جداً (الحد ٤ ميجابايت)' : 'File too large (4 MB limit)')
      return
    }
    const content = await file.text()
    if (content.startsWith('PK')) {
      setError(isAR
        ? 'هذا ملف Excel. احفظه بصيغة CSV، أو انسخ الخلايا من إكسل والصقها في المربع أدناه.'
        : 'That is an Excel workbook. Save it as CSV, or copy the cells and paste them below.')
      return
    }
    setOverride({})
    setText(content)
  }

  const submit = async () => {
    if (!preview || preview.recipes.length === 0) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          recipes: preview.recipes.map(r => ({
            name: r.name,
            units_per_batch: r.units_per_batch,
            output_unit: r.output_unit,
            sell_price: r.sell_price,
            ingredients: r.ingredients,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || (isAR ? 'تعذّر الاستيراد' : 'Import failed')); return }
      onDone(data)
    } catch {
      setError(isAR ? 'تعذّر الاتصال بالخادم' : 'Could not reach the server')
    } finally {
      setSaving(false)
    }
  }

  const columnOptions = preview
    ? (preview.sheet.header.length > 0
        ? preview.sheet.header.map((h, i) => ({ i, label: h || `#${i + 1}` }))
        : Array.from({ length: Math.max(...preview.sheet.rows.map(r => r.length), 1) },
            (_, i) => ({ i, label: `${isAR ? 'عمود' : 'Column'} ${i + 1}` })))
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box imp" onClick={e => e.stopPropagation()}>

        <div className="imp-head">
          <span className="imp-title">{isAR ? 'استيراد الوصفات من ملف' : 'Import recipes'}</span>
          <button className="imp-x" onClick={onClose} aria-label={isAR ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        {!preview && (
          <>
            <div className="imp-hint">
              {isAR
                ? 'سطر لكل مكوّن، واسم الوصفة يتكرر في عموده. اكتب عدد الوحدات وسعر البيع مرة واحدة في أول سطر من كل وصفة.'
                : 'One row per ingredient, with the recipe name repeated down its column. Units per batch and sell price go on the first row of each recipe.'}
            </div>

            <div className="imp-drop" onClick={() => fileRef.current?.click()}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div className="imp-drop-main">{isAR ? 'اختر ملف CSV' : 'Choose a CSV file'}</div>
              <div className="imp-drop-sub">
                {isAR ? 'أو الصق الخلايا من إكسل في المربع أدناه' : 'or paste cells from Excel below'}
              </div>
              <input
                ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }}
              />
            </div>

            <textarea
              className="imp-paste"
              dir="ltr"
              placeholder={
                'الوصفة\tالمكوّن\tالكمية\tعدد الوحدات\tسعر البيع\n' +
                'كرواسون\tدقيق\t500\t20\t12\n' +
                'كرواسون\tزبدة\t250\n' +
                'كيك\tدقيق\t300\t10\t6.5'
              }
              onPaste={e => {
                const v = e.clipboardData.getData('text/plain')
                if (v.trim()) { e.preventDefault(); setOverride({}); setText(v) }
              }}
              onChange={e => { setOverride({}); setText(e.target.value) }}
              value=""
            />
          </>
        )}

        {preview && (
          <>
            <div className="imp-map">
              {RECIPE_FIELDS.map(f => (
                <label key={f} className="imp-map-item">
                  <span className="imp-map-label">
                    {RECIPE_FIELD_LABELS[f][isAR ? 'ar' : 'en']}
                    {(f === 'recipe' || f === 'material' || f === 'amount') && <span className="imp-req">*</span>}
                  </span>
                  <select
                    value={preview.mapping[f] ?? -1}
                    onChange={e => setOverride(o => ({ ...o, [f]: Number(e.target.value) }))}
                  >
                    <option value={-1}>{isAR ? '— تجاهل —' : '— ignore —'}</option>
                    {columnOptions.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {/* The expensive mistake, first. */}
            {preview.unknownMaterials.length > 0 && (
              <div className="imp-unknown">
                <div className="imp-unknown-head">
                  {isAR
                    ? `${preview.unknownMaterials.length} مكوّن غير موجود في المخزون`
                    : `${preview.unknownMaterials.length} ingredients are not in stock`}
                </div>
                <div className="imp-unknown-body">
                  {isAR
                    ? 'هذه المكوّنات كوستها صفر، فتكلفة الوصفة وربحها يطلعان أقل من الحقيقة. أضفها للمخزون أو صحّح إملاءها أولاً.'
                    : 'These cost zero, so the recipe’s cost and profit come out understated. Add them to stock or fix their spelling first.'}
                </div>
                <div className="imp-unknown-list">
                  {preview.unknownMaterials.slice(0, 24).map(m => <span key={m} className="imp-chip">{m}</span>)}
                  {preview.unknownMaterials.length > 24 && (
                    <span className="imp-chip more">+{preview.unknownMaterials.length - 24}</span>
                  )}
                </div>
              </div>
            )}

            <div className="imp-counts">
              <span><b className="num">{counts.add}</b> {isAR ? 'وصفة جديدة' : 'new'}</span>
              <span className="imp-dot">·</span>
              <span><b className="num">{counts.update}</b> {isAR ? 'موجودة مسبقاً' : 'already exist'}</span>
              {preview.issues.length > 0 && (
                <>
                  <span className="imp-dot">·</span>
                  <span className="imp-warn"><b className="num">{preview.issues.length}</b> {isAR ? 'تنبيه' : 'issues'}</span>
                </>
              )}
            </div>

            {counts.update > 0 && (
              <div className="imp-mode">
                {(['update', 'skip'] as const).map(m => (
                  <button key={m} className={`imp-mode-btn${mode === m ? ' on' : ''}`} onClick={() => setMode(m)}>
                    {m === 'update'
                      ? (isAR ? 'حدّث الموجود' : 'Update existing')
                      : (isAR ? 'تخطَّ الموجود' : 'Skip existing')}
                  </button>
                ))}
              </div>
            )}

            <div className="imp-list">
              {preview.recipes.slice(0, 40).map(r => (
                <div key={r.name} className="imp-rec">
                  <div className="imp-rec-head">
                    <span className="imp-rec-name">{r.name}</span>
                    <span className={existing.has(r.name) ? 'imp-tag upd' : 'imp-tag new'}>
                      {existing.has(r.name) ? (isAR ? 'موجودة' : 'exists') : (isAR ? 'جديدة' : 'new')}
                    </span>
                    <span className="imp-rec-meta num">
                      {r.units_per_batch} {r.output_unit}
                      {r.sell_price > 0 && <> · {r.sell_price}</>}
                    </span>
                  </div>
                  <div className="imp-rec-ings">
                    {r.ingredients.map(g => (
                      <span key={g.material} className={materials.includes(g.material) ? 'imp-ing' : 'imp-ing bad'}>
                        {g.material} <b className="num">{g.amount}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {preview.recipes.length > 40 && (
                <div className="imp-more">
                  {isAR ? `و${preview.recipes.length - 40} وصفة أخرى…` : `and ${preview.recipes.length - 40} more…`}
                </div>
              )}
            </div>

            {preview.issues.length > 0 && (
              <details className="imp-issues">
                <summary>
                  {isAR ? `${preview.issues.length} سطر يحتاج انتباهاً` : `${preview.issues.length} rows need attention`}
                </summary>
                {preview.issues.slice(0, 40).map((iss, k) => (
                  <div key={k} className="imp-issue">
                    {iss.line > 0 && <span className="num">{isAR ? 'سطر' : 'line'} {iss.line}</span>}
                    {iss.recipe && <span className="imp-issue-f">{iss.recipe}</span>}
                    <span>{iss.message}</span>
                  </div>
                ))}
              </details>
            )}
          </>
        )}

        {error && <div className="imp-error">{error}</div>}

        <div className="imp-actions">
          {preview && (
            <button className="btn" onClick={() => { setText(''); setOverride({}); setError('') }}>
              {isAR ? 'ملف آخر' : 'Start over'}
            </button>
          )}
          <button className="btn" onClick={onClose}>{isAR ? 'إلغاء' : 'Cancel'}</button>
          <button
            className="btn btn-primary"
            disabled={!preview || preview.recipes.length === 0 || saving || (mode === 'skip' && counts.add === 0)}
            onClick={submit}
          >
            {saving
              ? (isAR ? 'جارٍ الاستيراد…' : 'Importing…')
              : isAR
                ? `استيراد ${mode === 'skip' ? counts.add : preview?.recipes.length ?? 0} وصفة`
                : `Import ${mode === 'skip' ? counts.add : preview?.recipes.length ?? 0}`}
          </button>
        </div>

        <style jsx>{`
          .imp { max-width: 820px; width: 100%; max-height: 88vh; overflow-y: auto }
          .imp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px }
          .imp-title { font-size: 16px; font-weight: 700 }
          .imp-x {
            background: transparent; border: none; cursor: pointer;
            font-size: 15px; color: #94a3b8; padding: 4px 8px; font-family: inherit;
          }
          .imp-hint {
            font-size: 12.5px; color: #475569; background: #f8fafc;
            border-radius: 9px; padding: 10px 12px; margin-bottom: 12px; line-height: 1.7;
          }

          .imp-drop {
            border: 1.5px dashed #cbd5e1; border-radius: 12px;
            padding: 26px 18px; text-align: center; cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
          }
          .imp-drop:hover { border-color: ${GREEN}; background: rgba(22,166,121,.04) }
          .imp-drop-main { font-size: 14px; font-weight: 600; margin-top: 8px }
          .imp-drop-sub { font-size: 12px; color: #94a3b8; margin-top: 4px }

          /* Tabular text is columns, so it is laid out left to right whatever
             the page direction; the Arabic inside each cell still shapes
             correctly. Left in RTL it read as a jumble of reversed columns. */
          .imp-paste {
            width: 100%; margin-top: 12px; min-height: 110px; resize: vertical;
            border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;
            font-size: 12.5px; font-family: inherit; line-height: 1.8; color: #0b0f1a;
            white-space: pre; overflow-x: auto;
          }
          .imp-paste::placeholder { color: #cbd5e1 }

          .imp-map {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
            gap: 10px; margin-bottom: 14px;
          }
          .imp-map-item { display: flex; flex-direction: column; gap: 4px }
          .imp-map-label { font-size: 11px; color: #64748b; font-weight: 600 }
          .imp-req { color: #dc2626; margin-inline-start: 3px }
          .imp-map-item select {
            border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 8px;
            font-size: 12.5px; font-family: inherit; background: #fff; color: #0b0f1a;
          }

          .imp-unknown {
            background: #fffbeb; border: 1.5px solid #fde68a;
            border-radius: 11px; padding: 12px 14px; margin-bottom: 14px;
          }
          .imp-unknown-head { font-size: 13.5px; font-weight: 700; color: #92400e }
          .imp-unknown-body { font-size: 12px; color: #b45309; margin: 5px 0 9px; line-height: 1.7 }
          .imp-unknown-list { display: flex; flex-wrap: wrap; gap: 5px }
          .imp-chip {
            background: #fff; border: 1px solid #fde68a; color: #92400e;
            border-radius: 99px; padding: 2px 9px; font-size: 11.5px; font-weight: 600;
          }
          .imp-chip.more { background: #fef3c7 }

          .imp-counts { display: flex; align-items: center; gap: 7px; font-size: 13px; margin-bottom: 10px }
          .imp-dot { color: #cbd5e1 }
          .imp-warn { color: #d97706 }

          .imp-mode { display: flex; gap: 6px; margin-bottom: 12px }
          .imp-mode-btn {
            background: #f8fafc; border: 1.5px solid transparent; color: #64748b;
            border-radius: 99px; padding: 5px 13px;
            font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
          }
          .imp-mode-btn.on { background: rgba(22,166,121,.1); border-color: ${GREEN}; color: #0f7a5c }

          .imp-list { border: 1px solid #eef2f7; border-radius: 10px; overflow: hidden; margin-bottom: 12px }
          .imp-rec { padding: 10px 12px; border-bottom: 1px solid #f6f8fb }
          .imp-rec:last-child { border-bottom: none }
          .imp-rec-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px }
          .imp-rec-name { font-weight: 700; font-size: 13.5px }
          .imp-rec-meta { font-size: 11.5px; color: #94a3b8; font-weight: 600 }
          .imp-tag { font-size: 10px; font-weight: 700; border-radius: 99px; padding: 2px 8px }
          .imp-tag.new { background: rgba(22,166,121,.1); color: #0f7a5c }
          .imp-tag.upd { background: #fffbeb; color: #b45309 }
          .imp-rec-ings { display: flex; flex-wrap: wrap; gap: 5px }
          .imp-ing {
            background: #f8fafc; border-radius: 7px; padding: 2px 8px;
            font-size: 11.5px; color: #475569;
          }
          .imp-ing.bad { background: #fffbeb; color: #b45309; border: 1px solid #fde68a }
          .imp-more { padding: 8px 12px; font-size: 11.5px; color: #94a3b8; background: #fbfcfe }

          .imp-issues { margin-bottom: 12px; font-size: 12px }
          .imp-issues summary { cursor: pointer; color: #b45309; font-weight: 600 }
          .imp-issue { display: flex; gap: 8px; padding: 5px 2px; color: #64748b; border-bottom: 1px solid #f6f8fb }
          .imp-issue-f { color: #94a3b8 }

          .imp-error {
            font-size: 12.5px; color: #b91c1c; background: #fef2f2;
            border: 1px solid #fecaca; border-radius: 9px; padding: 9px 12px; margin-bottom: 12px;
          }

          .imp-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }
        `}</style>
      </div>
    </div>
  )
}
