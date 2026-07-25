import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const GREEN = '#16a679'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [verifyEmailSuccess, setVerifyEmailSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('success')
    const e = params.get('error')
    if (s === 'verify_email') { setVerifyEmailSuccess(true); return }
    if (e === 'missing') setError('يرجى تعبئة جميع الحقول')
    else if (e === 'short_password') setError('كلمة المرور قصيرة — 6 أحرف على الأقل')
    else if (e === 'username_taken') setError('اسم المستخدم محجوز، اختر اسماً آخر')
    else if (e === 'invalid_email') setError('البريد الإلكتروني غير صحيح')
    else if (e === 'create_failed') setError('حدث خطأ، حاول مرة أخرى')
    else if (e) setError(e)
  }, [])

  if (verifyEmailSuccess) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-ui)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 52, height: 52, background: GREEN, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Bake<span style={{ color: GREEN }}>x</span></div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>تحقق من بريدك الإلكتروني</div>
            <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 6, lineHeight: 1.7 }}>
              أرسلنا لك رابط التحقق — افتحه لتفعيل حسابك.
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 24 }}>
              إذا لم يصل، تحقق من مجلد الـ Spam.
            </div>
            <button onClick={() => router.push('/login')}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-ui)' }}>

      {/* Back */}
      <button onClick={() => router.push('/')}
        style={{ position: 'fixed', top: 20, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#64748b', fontFamily: 'inherit' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        الرئيسية
      </button>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: GREEN, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Bake<span style={{ color: GREEN }}>x</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>أنشئ مخبزك الآن — مجاناً</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form method="POST" action="/api/users/create-bakery" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Section: Bakery */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>معلومات المخبز</div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>اسم المخبز</label>
              <input name="bakery_name" type="text" required placeholder="مثال: مخبز الأصيل"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Section: Admin */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginTop: 8 }}>حساب المدير</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>الاسم</label>
              <input name="name" type="text" required placeholder="اسمك الكامل"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>اسم المستخدم</label>
              <input name="username" type="text" required placeholder="admin" dir="ltr"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                البريد الإلكتروني
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginRight: 6 }}>(للتواصل واسترجاع الحساب)</span>
              </label>
              <input name="email" type="email" required placeholder="example@email.com" dir="ltr"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                رقم الجوال
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginRight: 6 }}>(واتساب للدعم الفني)</span>
              </label>
              <input name="phone" type="tel" required placeholder="05xxxxxxxx" dir="ltr"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>كلمة المرور</label>
              <input name="password" type="password" required placeholder="6 أحرف على الأقل" dir="ltr" minLength={6}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = GREEN}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <button type="submit"
              style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(22,166,121,0.3)', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#0e8060'}
              onMouseLeave={e => e.currentTarget.style.background = GREEN}>
              إنشاء المخبز
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#94a3b8' }}>
            عندك حساب؟{' '}
            <span onClick={() => router.push('/login')}
              style={{ color: GREEN, fontWeight: 600, cursor: 'pointer' }}>
              سجّل الدخول
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
