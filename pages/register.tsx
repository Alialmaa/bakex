import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const GREEN = '#16a679'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error')
    if (e === 'missing') setError('يرجى تعبئة جميع الحقول')
    else if (e === 'short_password') setError('كلمة المرور قصيرة — ٤ أحرف على الأقل')
    else if (e === 'username_taken') setError('اسم المستخدم محجوز، اختر اسماً آخر')
    else if (e === 'create_failed') setError('حدث خطأ، حاول مرة أخرى')
    else if (e) setError(e)
  }, [])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', -apple-system, sans-serif" }}>

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

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>كلمة المرور</label>
              <input name="password" type="password" required placeholder="٤ أحرف على الأقل" dir="ltr"
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
