import { useState } from 'react'
import { useRouter } from 'next/router'

const GREEN = '#16a679'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!password || password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمة المرور وتأكيدها غير متطابقتين'); return }
    if (!token) { setError('رابط غير صالح'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      const data = await res.json()
      if (res.ok) { setDone(true) }
      else setError(data.error || 'حدث خطأ')
    } finally { setLoading(false) }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-ui)' }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: GREEN, borderRadius: 14, marginBottom: 12, fontSize: 24 }}>🍞</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Bake<span style={{ color: GREEN }}>x</span></div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {!done ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>تعيين كلمة مرور جديدة</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>أدخل كلمة المرور الجديدة</div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>كلمة المرور الجديدة</div>
                <input
                  type="password" value={password} dir="ltr"
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>تأكيد كلمة المرور</div>
                <input
                  type="password" value={confirm} dir="ltr"
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <button
                onClick={handleSubmit} disabled={loading || !token}
                style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>تم تغيير كلمة المرور!</div>
              <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 20 }}>
                يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة
              </div>
              <button
                onClick={() => router.push('/login')}
                style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                تسجيل الدخول
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
