import { useRouter } from 'next/router'

const GREEN = '#16a679'

export default function NotFound() {
  const router = useRouter()
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: GREEN, letterSpacing: '-4px', lineHeight: 1, marginBottom: 12 }}>404</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>الصفحة غير موجودة</div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>الرابط الذي أدخلته غير صحيح أو تمت إزالته.</div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          العودة للوحة التحكم
        </button>
      </div>
    </div>
  )
}
