import { useState, useRef } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../../lib/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { generateZATCAQR } from '../../lib/zatca'

interface CartItem { id: string; name: string; price: number; qty: number }
interface Invoice {
  id: string; invoice_number: string; customer_name?: string
  items: CartItem[]; total: number; subtotal_excl_vat?: number
  vat_amount?: number; vat_rate?: number
  payment_method: string; created_at: string
}

const PURPLE = '#6366f1'
const PURPLE_DARK = '#4f46e5'
const GREEN = '#16a679'

export default function CashierPage({ user, products, bakeryName, bakerySettings }: any) {
  const [tab, setTab] = useState<'pos' | 'invoices'>('pos')
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoaded, setInvoicesLoaded] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<Invoice | null>(null)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const filtered = (products || []).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (p: any) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, price: p.sell_price || 0, qty: 1 }]
    })
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== id))
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const VAT_RATE = 15
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const vatAmount = parseFloat((subtotal * VAT_RATE / 100).toFixed(2))
  const total = parseFloat((subtotal + vatAmount).toFixed(2))
  const itemCount = cart.reduce((s, i) => s + i.qty, 0)
  const change = payMethod === 'cash' ? (parseFloat(cashGiven) || 0) - total : 0

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/cashier/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: customerName, items: cart, subtotal_excl_vat: subtotal, vat_amount: vatAmount, vat_rate: VAT_RATE, total, payment_method: payMethod }),
      })
      if (res.ok) {
        const invoice = await res.json()
        setReceipt(invoice)
        setCart([])
        setCashGiven('')
        setCustomerName('')
        setInvoicesLoaded(false)
      }
    } finally { setLoading(false) }
  }

  const loadInvoices = async () => {
    if (invoicesLoaded) return
    const res = await fetch('/api/cashier/invoices?limit=200')
    if (res.ok) { setInvoices(await res.json()); setInvoicesLoaded(true) }
  }

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank', 'width=380,height=620')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>فاتورة</title>
    <meta charset="utf-8"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Courier New',monospace;direction:rtl;padding:16px;font-size:12px;color:#111;background:#fff;max-width:320px;margin:auto}
      .center{text-align:center}
      .bold{font-weight:bold}
      .divider{border-top:1px dashed #ccc;margin:8px 0}
      .row{display:flex;justify-content:space-between;padding:3px 0}
      .total-row{display:flex;justify-content:space-between;padding:5px 0;font-weight:bold;font-size:14px}
      .logo{font-size:18px;font-weight:bold;margin-bottom:2px}
      .small{font-size:10px;color:#666}
      @media print{body{padding:0}}
    </style></head><body onload="window.print()">${content}</body></html>`)
    w.document.close()
  }

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    (inv.customer_name || '').toLowerCase().includes(invoiceSearch.toLowerCase())
  )

  const todayInvoices = invoices.filter(inv =>
    inv.created_at.startsWith(new Date().toISOString().split('T')[0])
  )
  const todayTotal = todayInvoices.reduce((s, inv) => s + Number(inv.total), 0)

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: '#1e1b4b', color: '#fff', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: PURPLE, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.2px' }}>نظام الكاشير</div>
            {bakeryName && <div style={{ fontSize: 11, color: '#a5b4fc' }}>{bakeryName}</div>}
          </div>
        </div>

        {/* Tabs in header */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 3, gap: 2 }}>
          {[
            { key: 'pos', label: 'نقطة البيع', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
            { key: 'invoices', label: 'الفواتير', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setTab(t.key as any); if (t.key === 'invoices') loadInvoices() }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#1e1b4b' : 'rgba(255,255,255,0.65)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon}/>
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#e0e7ff' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: '#6366f1' }}>{new Date().toLocaleDateString('ar-SA')}</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => window.location.href = '/dashboard'}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#c7d2fe', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            النظام
          </button>
          <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/cashier/login' }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            خروج
          </button>
        </div>
      </header>

      {/* POS Tab */}
      {tab === 'pos' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden', height: 'calc(100vh - 54px)' }}>

          {/* Products panel */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search bar */}
            <div style={{ padding: '14px 16px 10px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  style={{ paddingRight: 36, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Products grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>لا توجد منتجات</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>أضف سعر البيع للوصفات من نظام المخبز</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {filtered.map((p: any) => {
                    const inCart = cart.find(i => i.id === p.id)
                    return (
                      <button key={p.id} onClick={() => addToCart(p)}
                        style={{
                          background: inCart ? '#f0fdf4' : '#fff',
                          border: `1.5px solid ${inCart ? '#86efac' : '#e2e8f0'}`,
                          borderRadius: 12,
                          padding: '16px 12px 14px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.12s',
                          position: 'relative',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                        onMouseEnter={e => { if (!inCart) e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.12)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = inCart ? '#86efac' : '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                      >
                        {inCart && (
                          <div style={{ position: 'absolute', top: 8, left: 8, background: GREEN, color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                            {inCart.qty}
                          </div>
                        )}
                        <div style={{ width: 44, height: 44, background: '#f8fafc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/>
                          </svg>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginBottom: 5, lineHeight: 1.3 }}>{p.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>
                          {(p.sell_price || 0).toFixed(2)} <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>ر.س</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart panel */}
          <div style={{ background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.04)' }}>

            {/* Cart header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>الطلب</div>
                {itemCount > 0 && (
                  <div style={{ background: PURPLE, color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 600, padding: '1px 8px' }}>
                    {itemCount}
                  </div>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])}
                  style={{ background: '#fef2f2', border: 'none', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  مسح الكل
                </button>
              )}
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ width: 48, height: 48, background: '#f8fafc', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>اضغط على منتج لإضافته</div>
                </div>
              ) : (
                <div style={{ padding: '6px 0' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10, borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{item.price.toFixed(2)} ر.س / حبة</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, padding: '4px 6px' }}>
                        <button onClick={() => updateQty(item.id, item.qty - 1)}
                          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 15, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center', color: '#1e293b' }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)}
                          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 15, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>+</button>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', minWidth: 60, textAlign: 'left' }}>
                        {(item.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout section */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px' }}>

              {/* Customer name */}
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="اسم العميل (اختياري)"
                style={{ marginBottom: 12, fontSize: 13, background: '#f8fafc', border: '1px solid #e2e8f0' }}
              />

              {/* Subtotal + VAT */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#64748b' }}>
                  <span>{itemCount} منتج — المجموع قبل الضريبة</span>
                  <span>{subtotal.toFixed(2)} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#64748b' }}>
                  <span>ضريبة القيمة المضافة ١٥٪</span>
                  <span>{vatAmount.toFixed(2)} ر.س</span>
                </div>
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 14, padding: '10px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                <span>الإجمالي شامل الضريبة</span>
                <span style={{ color: GREEN }}>{total.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>ر.س</span></span>
              </div>

              {/* Payment method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {[
                  { v: 'cash', label: 'كاش', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
                  { v: 'card', label: 'شبكة / بطاقة', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                ].map(m => (
                  <button key={m.v} onClick={() => setPayMethod(m.v as any)}
                    style={{ padding: '9px 10px', borderRadius: 9, border: `2px solid ${payMethod === m.v ? PURPLE : '#e2e8f0'}`, background: payMethod === m.v ? '#eef2ff' : '#fff', color: payMethod === m.v ? PURPLE_DARK : '#64748b', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.12s' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon}/></svg>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cash received */}
              {payMethod === 'cash' && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 5 }}>المبلغ المستلم</div>
                  <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                    placeholder="0.00" dir="ltr"
                    style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', letterSpacing: '0.5px' }}
                  />
                  {cashGiven && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, padding: '7px 12px', borderRadius: 8, background: change >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${change >= 0 ? '#86efac' : '#fca5a5'}` }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: change >= 0 ? '#166534' : '#991b1b' }}>الباقي</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: change >= 0 ? '#16a34a' : '#dc2626' }}>{change.toFixed(2)} ر.س</span>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout button */}
              <button onClick={handleCheckout} disabled={cart.length === 0 || loading}
                style={{ width: '100%', background: cart.length === 0 ? '#e2e8f0' : PURPLE, color: cart.length === 0 ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: cart.length === 0 ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '-0.2px', transition: 'all 0.15s', boxShadow: cart.length > 0 ? '0 4px 14px rgba(99,102,241,0.3)' : 'none' }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    جاري المعالجة...
                  </span>
                ) : `إتمام الطلب • ${total.toFixed(2)} ر.س`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'فواتير اليوم', value: todayInvoices.length, sub: 'فاتورة', color: PURPLE },
              { label: 'مبيعات اليوم', value: todayTotal.toFixed(2), sub: 'ر.س', color: GREEN },
              { label: 'إجمالي الفواتير', value: invoices.length, sub: 'فاتورة', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>
                  {s.value} <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Search + table */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>سجل الفواتير</div>
              <div style={{ position: 'relative', width: 220 }}>
                <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                  placeholder="ابحث برقم الفاتورة أو الاسم..."
                  style={{ paddingRight: 30, fontSize: 12.5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
              </div>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 100px 90px 80px', padding: '9px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              {['رقم الفاتورة', 'العميل', 'الوقت', 'المبلغ', 'الدفع', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>لا توجد فواتير</div>
            ) : filteredInvoices.map(inv => (
              <div key={inv.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 100px 90px 80px', padding: '12px 18px', borderBottom: '1px solid #f8fafc', alignItems: 'center', transition: 'background 0.1s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => setSelectedInvoice(inv)}
              >
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: PURPLE_DARK }}>{inv.invoice_number}</div>
                <div style={{ fontSize: 13, color: '#374151' }}>{inv.customer_name || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {new Date(inv.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(inv.created_at).toLocaleDateString('ar-SA')}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{Number(inv.total).toFixed(2)} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>ر.س</span></div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: inv.payment_method === 'cash' ? '#f0fdf4' : '#eff6ff', color: inv.payment_method === 'cash' ? '#166534' : '#1e40af' }}>
                    {inv.payment_method === 'cash' ? 'كاش' : 'شبكة'}
                  </span>
                </div>
                <div>
                  <button onClick={e => { e.stopPropagation(); setSelectedInvoice(inv) }}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                    عرض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receipt modal after sale */}
      {receipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: '#f0fdf4', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>تم إتمام الطلب</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>رقم الفاتورة</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: PURPLE_DARK, fontFamily: 'monospace', background: '#eef2ff', borderRadius: 8, padding: '8px 16px', display: 'inline-block', marginBottom: 16 }}>{receipt.invoice_number}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1e293b', letterSpacing: '-1px', marginBottom: 20 }}>
              {Number(receipt.total).toFixed(2)} <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>ر.س</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => { setSelectedInvoice(receipt); setReceipt(null) }}
                style={{ background: PURPLE, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                طباعة
              </button>
              <button onClick={() => setReceipt(null)}
                style={{ background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                طلب جديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)', padding: 20 }}
          onClick={() => setSelectedInvoice(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>

            <div ref={printRef} dir="rtl">
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>{bakerySettings?.name || bakeryName || 'Bakex'}</div>
                {bakerySettings?.address && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{bakerySettings.city ? `${bakerySettings.city} — ` : ''}{bakerySettings.address}</div>}
                {bakerySettings?.phone && <div style={{ fontSize: 11, color: '#64748b' }}>هاتف: {bakerySettings.phone}</div>}
                {bakerySettings?.vat_number && <div style={{ fontSize: 11, color: '#64748b' }}>الرقم الضريبي: {bakerySettings.vat_number}</div>}
                {bakerySettings?.cr_number && <div style={{ fontSize: 11, color: '#64748b' }}>السجل التجاري: {bakerySettings.cr_number}</div>}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '8px 0', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: '#374151', marginBottom: 8 }}>فاتورة ضريبية مبسطة</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b' }}>رقم الفاتورة:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: PURPLE_DARK }}>{selectedInvoice.invoice_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 4 }}>
                  <span style={{ color: '#64748b' }}>التاريخ الميلادي:</span>
                  <span style={{ fontWeight: 500 }}>{new Date(selectedInvoice.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 4 }}>
                  <span style={{ color: '#64748b' }}>الوقت:</span>
                  <span style={{ fontWeight: 500 }}>{new Date(selectedInvoice.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {selectedInvoice.customer_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 4 }}>
                    <span style={{ color: '#64748b' }}>العميل:</span>
                    <span style={{ fontWeight: 600 }}>{selectedInvoice.customer_name}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', fontWeight: 600, paddingBottom: 6, borderBottom: '1px solid #f1f5f9', textTransform: 'uppercase' }}>
                  <span>الصنف</span><span>الكمية</span><span>السعر</span><span>الإجمالي</span>
                </div>
                {selectedInvoice.items.map((item: CartItem, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f8fafc', fontSize: 12.5 }}>
                    <span style={{ fontWeight: 500, flex: 2 }}>{item.name}</span>
                    <span style={{ color: '#64748b', flex: 1, textAlign: 'center' }}>{item.qty}</span>
                    <span style={{ color: '#64748b', flex: 1, textAlign: 'center' }}>{item.price.toFixed(2)}</span>
                    <span style={{ fontWeight: 700, flex: 1, textAlign: 'left' }}>{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 5 }}>
                  <span>المجموع قبل الضريبة</span>
                  <span>{(selectedInvoice.subtotal_excl_vat ?? Number(selectedInvoice.total) / 1.15).toFixed(2)} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  <span>ضريبة القيمة المضافة ({selectedInvoice.vat_rate ?? 15}٪)</span>
                  <span>{(selectedInvoice.vat_amount ?? Number(selectedInvoice.total) - Number(selectedInvoice.total) / 1.15).toFixed(2)} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: '#1e293b', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                  <span>الإجمالي شامل الضريبة</span>
                  <span style={{ color: GREEN }}>{Number(selectedInvoice.total).toFixed(2)} ر.س</span>
                </div>
              </div>

              {/* Payment + QR */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>طريقة الدفع</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedInvoice.payment_method === 'cash' ? 'كاش' : 'شبكة / بطاقة'}</div>
                </div>
                {bakerySettings?.vat_number && (() => {
                  const qr = generateZATCAQR({
                    sellerName: bakerySettings.name || bakeryName || 'Bakex',
                    vatNumber: bakerySettings.vat_number,
                    timestamp: selectedInvoice.created_at,
                    totalWithVat: Number(selectedInvoice.total).toFixed(2),
                    vatAmount: (selectedInvoice.vat_amount ?? Number(selectedInvoice.total) - Number(selectedInvoice.total) / 1.15).toFixed(2),
                  })
                  return (
                    <div style={{ textAlign: 'center' }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qr)}`} alt="ZATCA QR" width={90} height={90} style={{ borderRadius: 6 }} />
                      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>ZATCA QR</div>
                    </div>
                  )
                })()}
              </div>

              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#94a3b8', paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
                شكراً لزيارتكم • Powered by Bakex
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 20 }}>
              <button onClick={handlePrint}
                style={{ background: PURPLE, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                طباعة
              </button>
              <button onClick={() => setSelectedInvoice(null)}
                style={{ background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/cashier/login', permanent: false } }

  const bid = user.bakery_id
  const { data: products } = bid
    ? await supabaseAdmin.from('recipes').select('id,name,sell_price,output_unit').eq('bakery_id', bid).gt('sell_price', 0).order('name')
    : await supabaseAdmin.from('recipes').select('id,name,sell_price,output_unit').gt('sell_price', 0).order('name')

  let bakeryName = user.bakery_name || null
  let bakerySettings = null
  if (bid) {
    const { data: b } = await supabaseAdmin
      .from('bakeries')
      .select('name,vat_number,cr_number,address,city,phone,business_type')
      .eq('id', bid).single()
    if (b) { bakeryName = b.name || bakeryName; bakerySettings = b }
  }

  return { props: { user, products: products || [], bakeryName, bakerySettings } }
}
