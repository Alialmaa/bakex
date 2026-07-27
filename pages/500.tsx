import { useRouter } from 'next/router'

const GREEN = '#16a679'

export default function ServerError() {
  const router = useRouter()
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-ui)' }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-4px', lineHeight: 1, marginBottom: 12 }}>500</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>حدث خطأ في الخادم</div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => router.reload()}
            style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            إعادة المحاولة
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'transparent', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            لوحة التحكم
          </button>
        </div>
      </div>
    </div>
  )
}
