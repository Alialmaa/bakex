import { useState } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'

const GREEN = '#16a679'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email || !email.includes('@')) { setError('أدخل بريداً إلكترونياً صحيحاً'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) { setSent(true) }
      else setError(data.error || 'حدث خطأ')
    } finally { setLoading(false) }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: GREEN, borderRadius: 14, marginBottom: 12, fontSize: 24 }}>🍞</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Bake<span style={{ color: GREEN }}>x</span></div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {!sent ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>نسيت كلمة المرور؟</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>البريد الإلكتروني</div>
                <input
                  type="email" value={email} dir="ltr"
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="example@email.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <button
                onClick={handleSubmit} disabled={loading}
                style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>تم الإرسال!</div>
              <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, marginBottom: 20 }}>
                إذا كان هذا البريد مسجلاً لدينا، ستصلك رسالة بها رابط إعادة التعيين خلال دقيقة.<br/>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>الرابط صالح لمدة 15 دقيقة</span>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => router.push('/login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit', textDecoration: 'underline' }}>
              العودة لتسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (user) return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
