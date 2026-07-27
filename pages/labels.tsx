import { useEffect, useRef, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { useLang } from '../lib/useLang'
import { T } from '../lib/translations'
import QRCode from 'qrcode'

const GREEN = '#16a679'

function LabelCard({ item, type }: { item: any; type: 'recipe' | 'stock' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barcode = item.barcode || `BKX-${item.id.slice(0, 8).toUpperCase()}`

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, barcode, {
      width: 90,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    })
  }, [barcode])

  return (
    <div className="label-card" style={{
      border: '1px solid #d4d4d4',
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      background: '#fff',
      width: 140,
      boxSizing: 'border-box',
      pageBreakInside: 'avoid',
    }}>
      <canvas ref={canvasRef} style={{ borderRadius: 4 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#111', lineHeight: 1.3, wordBreak: 'break-word' }}>{item.name}</div>
        {type === 'recipe' && item.sell_price > 0 && (
          <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginTop: 2 }}>{item.sell_price} ر.س</div>
        )}
        {type === 'stock' && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{item.unit}</div>
        )}
        <div style={{ fontSize: 8, color: '#aaa', fontFamily: 'monospace', marginTop: 3, letterSpacing: '0.03em' }}>{barcode}</div>
      </div>
    </div>
  )
}

export default function LabelsPage({ user, recipes, stock }: any) {
  const { lang, setLang } = useLang()
  const isAR = lang === 'ar'
  const t = T[lang]

  const [tab, setTab] = useState<'recipe' | 'stock'>('recipe')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const items = tab === 'recipe' ? recipes : stock

  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const selectAll = () => setSelected(new Set(items.map((i: any) => i.id)))
  const clearAll = () => setSelected(new Set())

  const selectedItems = items.filter((i: any) => selected.has(i.id))

  // Save auto-generated barcodes for items that don't have one yet
  const saveBarcodes = async () => {
    setSaving(true)
    const unset = selectedItems.filter((i: any) => !i.barcode)
    await Promise.all(unset.map((i: any) =>
      fetch('/api/scanner/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: i.id, barcode: `BKX-${i.id.slice(0, 8).toUpperCase()}`, mode: tab }),
      })
    ))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-grid { display: flex !important; flex-wrap: wrap; gap: 8px; padding: 0; }
          body { margin: 0; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#555' }}>
            {isAR
              ? 'اختر المنتجات واطبع ملصقاتها — الكود المطبوع يُمسح بالكاميرا'
              : 'Select items and print their labels — the QR code is scannable by the camera'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {saved && <span style={{ fontSize: 13, color: GREEN, fontWeight: 600, alignSelf: 'center' }}>✓ {isAR ? 'تم الحفظ' : 'Saved'}</span>}
            <button onClick={saveBarcodes} disabled={saving || selected.size === 0} className="btn"
              style={{ fontSize: 13, padding: '7px 14px' }}>
              {saving ? '...' : (isAR ? 'حفظ الأكواد' : 'Save Codes')}
            </button>
            <button onClick={() => window.print()} disabled={selected.size === 0}
              className="btn btn-primary" style={{ fontSize: 13, padding: '7px 16px', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              {isAR ? `طباعة (${selected.size})` : `Print (${selected.size})`}
            </button>
          </div>
        </div>

        {/* Tab + select controls */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 9, padding: 3, gap: 3 }}>
            {(['recipe', 'stock'] as const).map(m => (
              <button key={m} onClick={() => { setTab(m); clearAll() }}
                style={{
                  padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                  background: tab === m ? '#fff' : 'transparent',
                  color: tab === m ? '#111' : '#888',
                  boxShadow: tab === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {m === 'recipe' ? (isAR ? 'الوصفات / المنتجات' : 'Recipes / Products') : (isAR ? 'المواد الخام' : 'Ingredients')}
              </button>
            ))}
          </div>
          <button onClick={selectAll} style={{ fontSize: 12, color: GREEN, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            {isAR ? 'تحديد الكل' : 'Select all'}
          </button>
          {selected.size > 0 && (
            <button onClick={clearAll} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {isAR ? 'إلغاء التحديد' : 'Clear'}
            </button>
          )}
        </div>

        {/* Item selector grid */}
        <div className="no-print card" style={{ padding: 16 }}>
          {items.length === 0
            ? <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 16 }}>
                {isAR ? 'لا توجد عناصر' : 'No items found'}
              </div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {items.map((item: any) => (
                  <div key={item.id} onClick={() => toggle(item.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${selected.has(item.id) ? GREEN : '#e0e0e0'}`,
                      background: selected.has(item.id) ? 'rgba(22,166,121,0.06)' : '#fff',
                      color: selected.has(item.id) ? GREEN : '#333',
                      fontWeight: selected.has(item.id) ? 600 : 400,
                      transition: 'all 0.1s',
                      userSelect: 'none',
                    }}>
                    {item.name}
                    {item.barcode && <span style={{ fontSize: 10, color: '#aaa', marginRight: 4 }}> ✓</span>}
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Label preview + print area */}
        {selectedItems.length > 0 && (
          <div>
            <div className="no-print" style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              {isAR ? 'معاينة الملصقات:' : 'Label preview:'}
            </div>
            <div className="print-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {selectedItems.map((item: any) => (
                <LabelCard key={item.id} item={item} type={tab} />
              ))}
            </div>
          </div>
        )}

        {selectedItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb', fontSize: 13 }}>
            {isAR ? 'اختر المنتجات أعلاه لمعاينة الملصقات' : 'Select items above to preview labels'}
          </div>
        )}
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { anyPerm: ['stock', 'produce'] })
  if (isRedirect(guard)) return guard
  const { user } = guard

  const bid = user.bakery_id
  const [{ data: recipes }, { data: stock }] = await Promise.all([
    supabaseAdmin.from('recipes').select('id, name, sell_price, barcode').eq('bakery_id', bid).order('name'),
    supabaseAdmin.from('stock').select('id, name, unit, barcode').eq('bakery_id', bid).order('name'),
  ])

  return { props: { user, recipes: recipes || [], stock: stock || [] } }
}
