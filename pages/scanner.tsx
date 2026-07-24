import { useEffect, useRef, useState, useCallback } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import Layout from '../components/Layout'
import { T } from '../lib/translations'
import { useLang } from '../lib/useLang'

type Mode = 'stock' | 'recipe'
type ScanResult =
  | { type: 'stock'; data: any }
  | { type: 'recipe'; data: any }
  | { type: 'not_found'; barcode: string }
  | null

const GREEN = '#16a679'

export default function ScannerPage({ user, allStock, allRecipes }: any) {
  const { lang, setLang } = useLang()
  const isAR = lang === 'ar'
  const t = T[lang]

  const [mode, setMode] = useState<Mode>('stock')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [hasDetector, setHasDetector] = useState(false)
  const [result, setResult] = useState<ScanResult>(null)
  const [loading, setLoading] = useState(false)
  const [addQty, setAddQty] = useState('')
  const [adding, setAdding] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [selectedItem, setSelectedItem] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const lastScannedRef = useRef('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>()
  const manualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHasDetector('BarcodeDetector' in window)
    manualInputRef.current?.focus()
    return () => stopCamera()
  }, [])

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      lastScannedRef.current = ''
    } catch (e: any) {
      setCameraError(isAR ? 'تعذّر الوصول للكاميرا. تأكد من الإذن.' : 'Cannot access camera. Check permissions.')
    }
  }

  const handleScan = useCallback(async (code: string) => {
    if (code === lastScannedRef.current || loading) return
    lastScannedRef.current = code
    setLoading(true)
    setResult(null)
    setSuccessMsg('')
    setSelectedItem('')
    try {
      const res = await fetch(`/api/scanner/lookup?barcode=${encodeURIComponent(code)}&mode=${mode}`)
      const data = await res.json()
      if (data.found) {
        setResult({ type: data.type, data: data.data })
      } else {
        setResult({ type: 'not_found', barcode: code })
      }
    } catch {
      setResult({ type: 'not_found', barcode: code })
    }
    setAddQty('')
    setLoading(false)
  }, [mode, loading])

  // BarcodeDetector loop — starts when scanning=true and detector is available
  useEffect(() => {
    if (!scanning || !hasDetector) return
    const detector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'code_93', 'data_matrix'],
    })
    let alive = true
    const tick = async () => {
      if (!alive || !videoRef.current || !streamRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length > 0) {
          handleScan(codes[0].rawValue)
        }
      } catch {}
      if (alive) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [scanning, hasDetector, handleScan])

  const addToStock = async () => {
    if (result?.type !== 'stock' || !addQty) return
    setAdding(true)
    const newQty = result.data.qty + parseFloat(addQty)
    const res = await fetch('/api/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: result.data.id, qty: newQty, min_qty: result.data.min_qty, price_per_unit: result.data.price_per_unit }),
    })
    if (res.ok) {
      setResult({ type: 'stock', data: { ...result.data, qty: newQty } })
      setSuccessMsg(isAR ? `تمت الإضافة — المخزون الجديد: ${newQty} ${result.data.unit}` : `Added — new stock: ${newQty} ${result.data.unit}`)
      setAddQty('')
      lastScannedRef.current = ''
    }
    setAdding(false)
  }

  const assignBarcode = async () => {
    if (!selectedItem || result?.type !== 'not_found') return
    setAssigning(true)
    const res = await fetch('/api/scanner/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedItem, barcode: result.barcode, mode }),
    })
    if (res.ok) {
      setSuccessMsg(isAR ? 'تم ربط الباركود بنجاح' : 'Barcode linked successfully')
      setResult(null)
      lastScannedRef.current = ''
    }
    setAssigning(false)
  }

  const modeItems = mode === 'stock' ? allStock : allRecipes

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520, margin: '0 auto' }}>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 4, gap: 4 }}>
          {(['stock', 'recipe'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setResult(null); lastScannedRef.current = ''; setSuccessMsg('') }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#111' : '#888',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>
              {m === 'stock'
                ? (isAR ? '📦 استلام مخزون' : '📦 Receive Stock')
                : (isAR ? '📋 بحث وصفة' : '📋 Recipe Lookup')}
            </button>
          ))}
        </div>

        {/* Camera viewport */}
        <div style={{ position: 'relative', background: '#111', borderRadius: 16, overflow: 'hidden', aspectRatio: '4/3' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} />

          {/* Scanning reticle */}
          {scanning && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ position: 'relative', width: 220, height: 130 }}>
                {/* Corner brackets */}
                {[
                  { top: 0, left: 0, borderTop: `2.5px solid ${GREEN}`, borderLeft: `2.5px solid ${GREEN}`, borderRadius: '6px 0 0 0' },
                  { top: 0, right: 0, borderTop: `2.5px solid ${GREEN}`, borderRight: `2.5px solid ${GREEN}`, borderRadius: '0 6px 0 0' },
                  { bottom: 0, left: 0, borderBottom: `2.5px solid ${GREEN}`, borderLeft: `2.5px solid ${GREEN}`, borderRadius: '0 0 0 6px' },
                  { bottom: 0, right: 0, borderBottom: `2.5px solid ${GREEN}`, borderRight: `2.5px solid ${GREEN}`, borderRadius: '0 0 6px 0' },
                ].map((style, i) => (
                  <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...style }} />
                ))}
                {/* Scan line */}
                <div style={{
                  position: 'absolute', left: 10, right: 10, top: '50%',
                  height: 2, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
                  animation: 'none', opacity: 0.8,
                }} />
              </div>
              <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                {loading
                  ? (isAR ? 'جاري البحث...' : 'Looking up...')
                  : (isAR ? 'وجّه الكاميرا نحو الباركود' : 'Point camera at barcode')}
              </div>
              {!hasDetector && (
                <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#fde68a' }}>
                  {isAR ? 'الكاميرا نشطة — استخدم الإدخال اليدوي' : 'Camera active — use manual input below'}
                </div>
              )}
            </div>
          )}

          {/* Start / error state */}
          {!scanning && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/>
                <path d="M21 16h-3v3M18 21h3M13 3v5h5M13 13h3v3h-3v3M8 13v5M13 21v-2"/>
              </svg>
              {cameraError
                ? <div style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>{cameraError}</div>
                : <button onClick={startCamera}
                    style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(22,166,121,0.4)' }}>
                    {isAR ? 'تشغيل الكاميرا' : 'Start Camera'}
                  </button>
              }
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                {isAR ? 'أو أدخل الباركود يدوياً أدناه' : 'Or enter barcode manually below'}
              </div>
            </div>
          )}
        </div>

        {/* Manual input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={manualInputRef}
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim()) { handleScan(manualCode.trim()); setManualCode(''); setTimeout(() => manualInputRef.current?.focus(), 100) } }}
            placeholder={isAR ? 'وجّه السكانر هنا أو أدخل الباركود...' : 'Scan here or enter barcode manually...'}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #16a679', fontSize: 13, fontFamily: 'inherit', direction: 'ltr' }}
            autoComplete="off"
          />
          <button onClick={() => { if (manualCode.trim()) { handleScan(manualCode.trim()); setManualCode('') } }}
            className="btn btn-primary" style={{ padding: '9px 18px', whiteSpace: 'nowrap' }}>
            {isAR ? 'بحث' : 'Search'}
          </button>
        </div>

        {/* Success message */}
        {successMsg && (
          <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#085041', fontWeight: 500 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Result card */}
        {loading && !result && (
          <div className="card" style={{ textAlign: 'center', color: '#888', fontSize: 13 }}>
            {isAR ? 'جاري البحث...' : 'Searching...'}
          </div>
        )}

        {result?.type === 'not_found' && (
          <div className="card" style={{ borderColor: '#fecaca', borderWidth: 1.5 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
              {isAR ? 'الباركود غير مسجّل في النظام' : 'Barcode not registered'}
            </div>
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginBottom: 14 }}>{result.barcode}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {isAR
                ? (mode === 'stock' ? 'اربطه بمادة خام موجودة:' : 'اربطه بوصفة موجودة:')
                : (mode === 'stock' ? 'Link to an existing material:' : 'Link to an existing recipe:')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1px solid #d4d4d4', fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">{isAR ? '— اختر —' : '— Select —'}</option>
                {modeItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button onClick={assignBarcode} disabled={assigning || !selectedItem}
                className="btn btn-primary" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                {assigning ? '...' : (isAR ? 'ربط' : 'Link')}
              </button>
            </div>
          </div>
        )}

        {result?.type === 'stock' && (
          <div className="card" style={{ borderColor: GREEN, borderWidth: 1.5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              {isAR ? 'مادة خام' : 'Raw Material'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{result.data.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{isAR ? 'المخزون الحالي' : 'Current Stock'}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{result.data.qty} <span style={{ fontSize: 12, fontWeight: 400 }}>{result.data.unit}</span></div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{isAR ? 'الحد الأدنى' : 'Min Level'}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{result.data.min_qty} <span style={{ fontSize: 12, fontWeight: 400 }}>{result.data.unit}</span></div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {isAR ? 'أضف الكمية المستلمة:' : 'Add received quantity:'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={addQty} min={0}
                onChange={e => setAddQty(e.target.value)}
                placeholder={isAR ? 'الكمية...' : 'Quantity...'}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid #d4d4d4', fontSize: 14, fontFamily: 'inherit' }}
              />
              <button onClick={addToStock} disabled={adding || !addQty}
                className="btn btn-primary" style={{ padding: '9px 18px', whiteSpace: 'nowrap' }}>
                {adding ? '...' : (isAR ? 'إضافة للمخزون' : 'Add to Stock')}
              </button>
            </div>
          </div>
        )}

        {result?.type === 'recipe' && (
          <div className="card" style={{ borderColor: GREEN, borderWidth: 1.5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              {isAR ? 'وصفة / منتج' : 'Recipe / Product'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{result.data.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{isAR ? 'كوست الوحدة' : 'Unit Cost'}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{(result.data.unit_cost || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{isAR ? 'سعر البيع' : 'Sell Price'}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: GREEN }}>{(result.data.sell_price || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{isAR ? 'الإنتاج' : 'Output'}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{result.data.units_per_batch} <span style={{ fontSize: 11, fontWeight: 400 }}>{result.data.output_unit}</span></div>
              </div>
            </div>
            {result.data.ingredients?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
                  {isAR ? 'المكونات:' : 'Ingredients:'}
                </div>
                {result.data.ingredients.map((ing: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                    <span>{ing.material}</span>
                    <span style={{ color: '#666' }}>{ing.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stop camera button */}
        {scanning && (
          <button onClick={stopCamera}
            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 9, padding: '9px 0', fontSize: 13, color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
            {isAR ? 'إيقاف الكاميرا' : 'Stop Camera'}
          </button>
        )}
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.stock && !user.perms?.produce) return { redirect: { destination: '/403', permanent: false } }

  const { supabaseAdmin } = await import('../lib/supabase')
  const bid = user.bakery_id

  const [{ data: allStock }, { data: allRecipes }] = await Promise.all([
    supabaseAdmin.from('stock').select('id, name, qty, unit, min_qty, price_per_unit, barcode').eq('bakery_id', bid).order('name'),
    supabaseAdmin.from('recipes').select('id, name, ingredients, units_per_batch, output_qty, output_unit, sell_price, barcode').eq('bakery_id', bid).order('name'),
  ])

  return { props: { user, allStock: allStock || [], allRecipes: allRecipes || [] } }
}
