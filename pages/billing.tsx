import { useState } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { checkBakeryAccess } from '../lib/subscription'
import { paymentConfig, whatsappUrl, type PaymentConfig } from '../lib/payment'

const GREEN = '#16a679'
const DARK = '#0b0f1a'

/** Everything listed here is in the product today. Nothing planned. */
const INCLUDED = [
  'المخزون والمواد الخام مع تنبيهات النفاد',
  'الوصفات وحساب تكلفة كل منتج تلقائياً',
  'تسجيل الإنتاج وخصم المواد في عملية واحدة',
  'الكاشير والفواتير مربوطة بالمخزون',
  'تقارير الإيراد والتكلفة والربح لكل منتج',
  'حسابات غير محدودة بصلاحيات لكل موظف',
  'تحديثات النظام ودعم فني طوال الاشتراك',
]

export default function BillingPage({ user, payment }: { user: any; payment: PaymentConfig }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const billing = user?.billing ?? null
  const status = billing?.status ?? 'trial'
  const daysLeft = billing?.daysLeft ?? 0
  const isActive = status === 'active'
  const isExpired = status === 'expired' || (billing ? !billing.allowed : false)
  const urgency = isExpired || daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : GREEN

  const waText = `أريد الاشتراك في Bakex — ${user?.bakery_name || 'مخبزي'}`

  const copyIban = async () => {
    if (!payment.bank) return
    try {
      await navigator.clipboard.writeText(payment.bank.iban.replace(/\s/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the number is on screen anyway */ }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f6f8fb', fontFamily: 'var(--font-ui)', color: DARK }}>

      <div style={{ background: '#fff', borderBottom: '1px solid #e8ecf1', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.5px' }}>Bake<span style={{ color: GREEN }}>x</span></span>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>
          العودة للوحة التحكم
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '40px auto 64px', padding: '0 20px' }}>

        {/* Status */}
        <div style={{ background: '#fff', border: `1.5px solid ${isExpired ? '#fecaca' : isActive ? 'rgba(22,166,121,.3)' : '#e8ecf1'}`, borderRadius: 16, padding: '22px 24px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isExpired ? '#fef2f2' : isActive ? 'rgba(22,166,121,.1)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isActive ? GREEN : urgency} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {isActive ? <polyline points="20 6 9 17 4 12"/> : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {isActive ? 'اشتراكك نشط' : isExpired ? 'انتهى اشتراكك' : 'أنت في الفترة التجريبية'}
              </div>
              <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 3 }}>
                {isExpired
                  ? 'فعّل اشتراكك لاستعادة الوصول — بياناتك محفوظة كما هي'
                  : <>يتبقّى <span className="num" style={{ fontWeight: 700, color: urgency }}>{daysLeft}</span> يوماً</>}
              </div>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div style={{ background: '#fff', border: '1.5px solid #e8ecf1', borderRadius: 16, padding: '26px 24px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>الاشتراك السنوي</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px' }}>{payment.price.toLocaleString('en-US')}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>ريال</span>
            <span style={{ fontSize: 14, color: '#94a3b8' }}>/ سنة</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', margin: '6px 0 22px' }}>دفعة واحدة سنوياً · شاملة تابلت لتشغيل الكاشير</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {INCLUDED.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 18, height: 18, background: 'rgba(22,166,121,.1)', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment */}
        {!isActive && (
          <div style={{ background: '#fff', border: '1.5px solid #e8ecf1', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', fontSize: 15, fontWeight: 700 }}>طريقة الدفع</div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {payment.link && (
                <a href={payment.link} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: GREEN, color: '#fff', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(22,166,121,.28)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  ادفع بالبطاقة — <span className="num">{payment.price.toLocaleString('en-US')}</span> ريال
                </a>
              )}

              {payment.bank && (
                <div style={{ border: '1.5px solid #e8ecf1', borderRadius: 12, padding: '16px 18px', background: '#fbfcfe' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>تحويل بنكي</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: '#64748b' }}>البنك</span><span style={{ fontWeight: 600 }}>{payment.bank.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: '#64748b' }}>اسم الحساب</span><span style={{ fontWeight: 600 }}>{payment.bank.accountName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: '#64748b' }}>الآيبان</span>
                      <button onClick={copyIban}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, background: copied ? 'rgba(22,166,121,.1)' : '#fff', border: `1.5px solid ${copied ? GREEN : '#e2e8f0'}`, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontFamily: 'inherit', color: copied ? GREEN : DARK }}>
                        <span className="num" style={{ fontSize: 12.5, fontWeight: 600, direction: 'ltr' }}>{payment.bank.iban}</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {copied ? <polyline points="20 6 9 17 4 12"/> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>}
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 13, lineHeight: 1.7, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
                    بعد التحويل أرسل صورة الإيصال على واتساب ويُفعَّل حسابك خلال ساعات العمل.
                  </div>
                </div>
              )}

              <a href={whatsappUrl(payment.whatsapp, waText)} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: payment.link ? 'transparent' : GREEN, color: payment.link ? '#374151' : '#fff', border: payment.link ? '1.5px solid #e2e8f0' : 'none', borderRadius: 12, padding: '13px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
                {payment.link ? 'عندك سؤال؟ راسلنا على واتساب' : 'تواصل معنا للاشتراك'}
              </a>
            </div>
          </div>
        )}

        {isActive && (
          <div style={{ textAlign: 'center', fontSize: 14, color: GREEN, fontWeight: 600, padding: 16, background: 'rgba(22,166,121,.06)', border: '1.5px solid rgba(22,166,121,.2)', borderRadius: 14 }}>
            شكراً لاشتراكك — لأي استفسار{' '}
            <a href={whatsappUrl(payment.whatsapp, 'استفسار عن اشتراكي في Bakex')} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, textDecoration: 'underline' }}>راسلنا</a>
          </div>
        )}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  // skipSubscription, or an expired customer could never reach the page that
  // takes their money. It also means requirePage does not attach `billing`, so
  // this page — the one that must *show* the status rather than enforce it —
  // reads it itself.
  const guard = await requirePage(req as any, { skipSubscription: true })
  if (isRedirect(guard)) return guard

  const user = guard.user
  let billing: { status: string; daysLeft: number; allowed: boolean } | null = null
  if (user.bakery_id) {
    try {
      const access = await checkBakeryAccess(user.bakery_id)
      billing = { status: access.status, daysLeft: access.daysLeft, allowed: access.allowed }
    } catch {
      // Unreadable subscription must not block the payment page — the customer
      // can still pay, which is the whole point of being here.
    }
  }

  return { props: { user: { ...user, billing }, payment: paymentConfig() } }
}
