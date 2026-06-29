import { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import Layout from '../components/Layout'
import { useLang } from '../lib/useLang'

const BUSINESS_TYPES = [
  'مخبز', 'مطعم', 'كافيه', 'بقالة / سوبرماركت',
  'صيدلية', 'محل ملابس', 'محل إلكترونيات', 'خدمات', 'أخرى',
]

export default function SettingsPage({ user }: any) {
  const { lang, setLang } = useLang()
  const [form, setForm] = useState({
    name: '', vat_number: '', cr_number: '',
    address: '', city: '', phone: '', business_type: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d && !d.error) {
        setForm({
          name: d.name || '',
          vat_number: d.vat_number || '',
          cr_number: d.cr_number || '',
          address: d.address || '',
          city: d.city || '',
          phone: d.phone || '',
          business_type: d.business_type || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>جاري التحميل...</div>
    </Layout>
  )

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {saved && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            تم حفظ الإعدادات بنجاح
          </div>
        )}

        {/* Company Info */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a679" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            بيانات المنشأة
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>اسم المنشأة *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: مخبز الأصيل" />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>نوع النشاط التجاري</label>
              <select value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                <option value="">اختر...</option>
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>رقم الهاتف</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>المدينة</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="الرياض" />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>العنوان</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="حي النزهة، شارع الملك فهد" />
            </div>
          </div>
        </div>

        {/* VAT / ZATCA */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            بيانات الضريبة — ZATCA
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '10px 14px', fontSize: 12.5, color: '#1e40af', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            هذه البيانات تظهر على الفاتورة الضريبية وتُستخدم لإنشاء الـ QR Code المطلوب من هيئة الزكاة والضريبة والجمارك
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                رقم التسجيل الضريبي (VAT)
                <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 6 }}>15 رقم</span>
              </label>
              <input value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="300000000000003" dir="ltr" maxLength={15} />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                رقم السجل التجاري (CR)
                <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 6 }}>10 أرقام</span>
              </label>
              <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} placeholder="1010000000" dir="ltr" maxLength={10} />
            </div>
          </div>

          {form.vat_number && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', borderRadius: 9, border: '1px solid #bbf7d0', fontSize: 12.5, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              سيظهر QR Code على كل فاتورة تلقائياً
            </div>
          )}
        </div>

        {/* VAT Rate */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            نسبة ضريبة القيمة المضافة
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#92400e' }}>١٥٪</span>
              <span style={{ fontSize: 12, color: '#b45309' }}>ضريبة القيمة المضافة<br/>المعدل المعتمد في السعودية</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.7 }}>
              يتم إضافة الضريبة تلقائياً على كل فاتورة.<br />
              السعر المدخل + ١٥٪ = الإجمالي للعميل.
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user } }
}
