import { useRouter } from 'next/router'

const GREEN = '#16a679'

export default function VerifyEmailPage() {
  const router = useRouter()
  const { success, error } = router.query

  const isSuccess = !!success
  const isAlready = success === 'already'
  const isInvalid = error === 'invalid'

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: GREEN, borderRadius: 14, marginBottom: 12, fontSize: 24 }}>🍞</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Bake<span style={{ color: GREEN }}>x</span></div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          {isInvalid ? (
            <>
              <div style={{ width: 56, height: 56, background: '#fef2f2', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>رابط غير صالح</div>
              <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 20 }}>الرابط منتهي الصلاحية أو غير صحيح.</div>
            </>
          ) : isAlready ? (
            <>
              <div style={{ width: 56, height: 56, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>البريد مؤكّد مسبقاً</div>
              <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 20 }}>يمكنك تسجيل الدخول الآن.</div>
            </>
          ) : (
            <>
              <div style={{ width: 56, height: 56, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>تم تأكيد البريد الإلكتروني!</div>
              <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 20 }}>حسابك مفعّل الآن. انتظر كود الدخول من المدير لتتمكن من استخدام النظام.</div>
            </>
          )}

          <button onClick={() => router.push('/login')}
            style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  )
}
