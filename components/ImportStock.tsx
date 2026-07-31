import { useMemo, useRef, useState } from 'react'
import {
  buildPreview, detectMapping, STOCK_FIELDS, FIELD_LABELS, MAX_IMPORT_ROWS,
  type Mapping, type StockField,
} from '../lib/importStock'

/**
 * Bringing an existing inventory in from a spreadsheet.
 *
 * Two ways in, because the friction is the point: pick a `.csv`, or select the
 * cells in Excel and paste. Pasting is usually faster than saving a copy, and
 * the clipboard carries tab-separated text, which the same parser reads.
 *
 * Nothing is sent until the user has seen what will happen. The preview shows
 * the mapping it guessed — with every column changeable, since no synonym list
 * covers every sheet — and lists the rows it could not read rather than
 * dropping them quietly.
 */

const GREEN = '#16a679'

export default function ImportStock({
  lang, existingNames, onClose, onDone,
}: {
  lang: string
  existingNames: string[]
  onClose: () => void
  onDone: (result: { added: number; updated: number; skipped: number }) => void
}) {
  const isAR = lang === 'ar'
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [override, setOverride] = useState<Mapping>({})
  const [mode, setMode] = useState<'update' | 'skip'>('update')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(
    () => (text.trim() ? buildPreview(text, override) : null),
    [text, override]
  )

  const existing = useMemo(() => new Set(existingNames), [existingNames])
  const counts = useMemo(() => {
    if (!preview) return { add: 0, update: 0 }
    let add = 0, update = 0
    for (const r of preview.rows) (existing.has(r.name) ? update++ : add++)
    return { add, update }
  }, [preview, existing])

  const readFile = async (file: File) => {
    setError('')
    if (file.size > 4_000_000) {
      setError(isAR ? 'الملف كبير جداً (الحد ٤ ميجابايت)' : 'File too large (4 MB limit)')
      return
    }
    // Read as text: a .xlsx is a zip and will arrive as mojibake, so say so
    // rather than showing a preview full of nonsense.
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
    if (!preview || preview.rows.length === 0) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/stock/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          rows: preview.rows.map(r => ({
            name: r.name, unit: r.unit, qty: r.qty,
            min_qty: r.min_qty, price_per_unit: r.price_per_unit,
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
          <span className="imp-title">{isAR ? 'استيراد المواد من ملف' : 'Import materials'}</span>
          <button className="imp-x" onClick={onClose} aria-label={isAR ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        {!preview && (
          <>
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
              placeholder={isAR
                ? 'الصق هنا — مثال:\nاسم المادة\tالوحدة\tالكمية\tالحد الأدنى\tسعر الوحدة\nدقيق\tكجم\t50\t10\t4.5'
                : 'Paste here — e.g.\nMaterial\tUnit\tQty\tMin\tPrice\nFlour\tkg\t50\t10\t4.5'}
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
            {/* Column mapping */}
            <div className="imp-map">
              {STOCK_FIELDS.map(f => (
                <label key={f} className="imp-map-item">
                  <span className="imp-map-label">
                    {FIELD_LABELS[f][isAR ? 'ar' : 'en']}
                    {f === 'name' && <span className="imp-req">*</span>}
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

            {/* What will happen */}
            <div className="imp-counts">
              <span><b className="num">{counts.add}</b> {isAR ? 'مادة جديدة' : 'new'}</span>
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

            {/* Rows */}
            <div className="imp-table">
              <div className="imp-row imp-th">
                <span>{FIELD_LABELS.name[isAR ? 'ar' : 'en']}</span>
                <span>{FIELD_LABELS.unit[isAR ? 'ar' : 'en']}</span>
                <span>{FIELD_LABELS.qty[isAR ? 'ar' : 'en']}</span>
                <span>{FIELD_LABELS.min_qty[isAR ? 'ar' : 'en']}</span>
                <span>{FIELD_LABELS.price_per_unit[isAR ? 'ar' : 'en']}</span>
                <span />
              </div>
              {preview.rows.slice(0, 100).map(r => (
                <div key={r.name} className="imp-row">
                  <span className="imp-name">{r.name}</span>
                  <span>{r.unit || '—'}</span>
                  <span className="num">{r.qty}</span>
                  <span className="num">{r.min_qty}</span>
                  <span className="num">{r.price_per_unit}</span>
                  <span className={existing.has(r.name) ? 'imp-tag upd' : 'imp-tag new'}>
                    {existing.has(r.name) ? (isAR ? 'موجودة' : 'exists') : (isAR ? 'جديدة' : 'new')}
                  </span>
                </div>
              ))}
              {preview.rows.length > 100 && (
                <div className="imp-more">
                  {isAR
                    ? `و${preview.rows.length - 100} مادة أخرى…`
                    : `and ${preview.rows.length - 100} more…`}
                </div>
              )}
            </div>

            {preview.issues.length > 0 && (
              <details className="imp-issues">
                <summary>
                  {isAR ? `${preview.issues.length} صف يحتاج انتباهاً` : `${preview.issues.length} rows need attention`}
                </summary>
                {preview.issues.slice(0, 40).map((iss, k) => (
                  <div key={k} className="imp-issue">
                    <span className="num">{isAR ? 'سطر' : 'line'} {iss.line}</span>
                    {iss.field && <span className="imp-issue-f">{FIELD_LABELS[iss.field as StockField][isAR ? 'ar' : 'en']}</span>}
                    <span>{iss.message}</span>
                  </div>
                ))}
              </details>
            )}

            {preview.duplicates.length > 0 && (
              <div className="imp-note">
                {isAR
                  ? `أسماء مكرّرة في الملف، أُخذ آخر صف لكل منها: ${preview.duplicates.slice(0, 6).join('، ')}`
                  : `Repeated names, last row kept: ${preview.duplicates.slice(0, 6).join(', ')}`}
              </div>
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
            disabled={!preview || preview.rows.length === 0 || saving || (mode === 'skip' && counts.add === 0)}
            onClick={submit}
          >
            {saving
              ? (isAR ? 'جارٍ الاستيراد…' : 'Importing…')
              : isAR
                ? `استيراد ${mode === 'skip' ? counts.add : preview?.rows.length ?? 0} مادة`
                : `Import ${mode === 'skip' ? counts.add : preview?.rows.length ?? 0}`}
          </button>
        </div>

        <style jsx>{`
          .imp { max-width: 780px; width: 100%; max-height: 88vh; overflow-y: auto }
          .imp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px }
          .imp-title { font-size: 16px; font-weight: 700 }
          .imp-x {
            background: transparent; border: none; cursor: pointer;
            font-size: 15px; color: #94a3b8; padding: 4px 8px; font-family: inherit;
          }

          .imp-drop {
            border: 1.5px dashed #cbd5e1; border-radius: 12px;
            padding: 26px 18px; text-align: center; cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
          }
          .imp-drop:hover { border-color: ${GREEN}; background: rgba(22,166,121,.04) }
          .imp-drop-main { font-size: 14px; font-weight: 600; margin-top: 8px }
          .imp-drop-sub { font-size: 12px; color: #94a3b8; margin-top: 4px }

          .imp-paste {
            width: 100%; margin-top: 12px; min-height: 96px; resize: vertical;
            border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;
            font-size: 12.5px; font-family: inherit; line-height: 1.7; color: #0b0f1a;
          }
          .imp-paste::placeholder { color: #cbd5e1 }

          .imp-map {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px; margin-bottom: 14px;
          }
          .imp-map-item { display: flex; flex-direction: column; gap: 4px }
          .imp-map-label { font-size: 11px; color: #64748b; font-weight: 600 }
          .imp-req { color: #dc2626; margin-inline-start: 3px }
          .imp-map-item select {
            border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 8px;
            font-size: 12.5px; font-family: inherit; background: #fff; color: #0b0f1a;
          }

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

          .imp-table { border: 1px solid #eef2f7; border-radius: 10px; overflow: hidden; margin-bottom: 12px }
          .imp-row {
            display: grid; grid-template-columns: 1.6fr 0.7fr 0.7fr 0.7fr 0.8fr 62px;
            gap: 8px; padding: 8px 12px; font-size: 12.5px; align-items: center;
            border-bottom: 1px solid #f6f8fb;
          }
          .imp-row:last-child { border-bottom: none }
          .imp-th { background: #f8fafc; font-size: 11px; color: #64748b; font-weight: 700 }
          .imp-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
          .imp-tag { font-size: 10px; font-weight: 700; border-radius: 99px; padding: 2px 8px; text-align: center }
          .imp-tag.new { background: rgba(22,166,121,.1); color: #0f7a5c }
          .imp-tag.upd { background: #fffbeb; color: #b45309 }
          .imp-more { padding: 8px 12px; font-size: 11.5px; color: #94a3b8; background: #fbfcfe }

          .imp-issues { margin-bottom: 12px; font-size: 12px }
          .imp-issues summary { cursor: pointer; color: #b45309; font-weight: 600 }
          .imp-issue { display: flex; gap: 8px; padding: 5px 2px; color: #64748b; border-bottom: 1px solid #f6f8fb }
          .imp-issue-f { color: #94a3b8 }

          .imp-note {
            font-size: 12px; color: #b45309; background: #fffbeb;
            border: 1px solid #fef3c7; border-radius: 9px; padding: 8px 11px; margin-bottom: 12px;
          }
          .imp-error {
            font-size: 12.5px; color: #b91c1c; background: #fef2f2;
            border: 1px solid #fecaca; border-radius: 9px; padding: 9px 12px; margin-bottom: 12px;
          }

          .imp-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }

          @media (max-width: 560px) {
            .imp-row { grid-template-columns: 1.4fr 0.6fr 0.6fr 56px; }
            .imp-row > :nth-child(4), .imp-row > :nth-child(5) { display: none }
          }
        `}</style>
      </div>
    </div>
  )
}
