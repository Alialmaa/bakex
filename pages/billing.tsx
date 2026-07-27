import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { fmtDate } from '../lib/datetime'

const GREEN = '#16a679'
const PRICE = '2,500'

type BillingData = {
  status: string
  daysLeft: number
  allowed: boolean
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
}

export default function BillingPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/billing')
      .then(r => r.json())
      .then(d => { setBilling(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const isExpired = billing?.status === 'expired'
  const isTrial = billing?.status === 'trial'
  const isActive = billing?.status === 'active'
  const daysLeft = billing?.daysLeft ?? 0

  const urgency = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : GREEN

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-ui)' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.5px' }}>Bake<span style={{ color: GREEN }}>x</span></span>
        </div>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>
          العودة للوحة التحكم
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>

        {/* Status card */}
        {!loading && billing && (
          <div style={{ background: '#fff', border: `1.5px solid ${isExpired ? '#fecaca' : isActive ? 'rgba(22,166,121,0.3)' : '#e2e8f0'}`, borderRadius: 16, padding: 28, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isExpired ? '#fef2f2' : isActive ? 'rgba(22,166,121,0.1)' : '#f8fafc', border: `1.5px solid ${isExpired ? '#fecaca' : isActive ? 'rgba(22,166,121,0.3)' : '#e2e8f0'}` }}>
                {isActive
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : isExpired
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={urgency} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                }
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                  {isActive ? 'الاشتراك نشط' : isExpired ? 'انتهت التجربة المجانية' : 'في فترة التجربة المجانية'}
                </div>
                <div style={{ fontSize: 13, color: isExpired ? '#dc2626' : '#64748b', marginTop: 2 }}>
                  {isActive && billing.subscriptionEndsAt
                    ? `ينتهي الاشتراك في ${fmtDate(billing.subscriptionEndsAt, 'ar')}`
                    : isExpired
                    ? 'لا يمكنك الوصول للنظام حتى يتم الاشتراك'
                    : `تبقّى ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} من التجربة المجانية`
                  }
                </div>
              </div>
            </div>

            {isTrial && daysLeft > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#64748b' }}>
                  <span>التجربة المجانية</span>
                  <span style={{ color: urgency, fontWeight: 600 }}>{daysLeft} يوم متبقي</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (daysLeft / 30) * 100)}%`, background: urgency, borderRadius: 99, transition: 'width 0.4s' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plan card */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16 }}>الباقة الوحيدة</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px' }}>{PRICE}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>ريال</span>
            <span style={{ fontSize: 14, color: '#94a3b8', marginRight: 4 }}>/ سنة</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>دفعة واحدة سنوياً — بدون رسوم شهرية</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[
              'إدارة كاملة للمخزون والوصفات',
              'تقارير المبيعات والأرباح',
              'حسابات الكوست الدقيقة',
              'فوترة ZATCA متوافقة',
              'عدد غير محدود من الحسابات',
              'دعم فني متواصل',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, background: 'rgba(22,166,121,0.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 14, color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Subscribe CTA */}
          {!isActive && (
            <a
              href="https://wa.me/966559219189?text=أريد الاشتراك في Bakex"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', boxShadow: '0 4px 14px rgba(22,166,121,0.3)' }}>
              اشترك الآن — {PRICE} ريال / سنة
            </a>
          )}

          {isActive && (
            <div style={{ textAlign: 'center', fontSize: 14, color: GREEN, fontWeight: 600, padding: 14, background: 'rgba(22,166,121,0.06)', borderRadius: 12 }}>
              اشتراكك نشط — شكراً لك
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
          للاستفسار تواصل معنا عبر واتساب أو البريد الإلكتروني
        </div>
      </div>
    </div>
  )
}
