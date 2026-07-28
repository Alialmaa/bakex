import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useTilt } from '../lib/useTilt'

const GREEN = '#16a679'
const DARK = '#0b0f1a'

/**
 * Three slides on the dark panel, matching the login page: the wordmark alone at
 * display size, then two hooks.
 *
 * These two are deliberately different from the login page's. Someone on this
 * page has not signed up yet, so they answer "why start" — the trial and how
 * quickly the system is usable — rather than describing daily features.
 */
type Slide =
  | { kind: 'logo'; tagline: string }
  | { kind: 'hook'; badge: string; title: string; desc: string }

const SLIDES: Slide[] = [
  {
    kind: 'logo',
    tagline: 'أنشئ مخبزك الآن — وجرّب كل شيء قبل أن تدفع ريالاً واحداً',
  },
  {
    kind: 'hook',
    badge: 'تجربة مجانية',
    title: 'شهر كامل، بدون دفع',
    desc: 'جرّب النظام بكل مميزاته ٣٠ يوماً — بدون بطاقة ائتمان وبدون التزام. وإذا لم تشترك، بياناتك تبقى كما هي بانتظارك.',
  },
  {
    kind: 'hook',
    badge: 'ابدأ اليوم',
    title: 'من التسجيل إلى أول فاتورة',
    desc: 'أضف وصفاتك ومخزونك وموظفيك بصلاحيات محددة لكل واحد، وافتح الكاشير من أي جهاز — بدون تدريب ولا إعداد معقّد.',
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [verifyEmailSuccess, setVerifyEmailSuccess] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)
  const [held, setHeld] = useState(false)
  const tilt = useTilt(7)
  const slide = SLIDES[slideIdx]

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

  // Advances on its own, and stops for good once the visitor picks a slide.
  useEffect(() => {
    if (held || verifyEmailSuccess) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setSlideIdx(i => (i + 1) % SLIDES.length), 6000)
    return () => clearInterval(t)
  }, [held, verifyEmailSuccess])

  if (verifyEmailSuccess) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-ui)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.7px' }}>Bake<span style={{ color: GREEN }}>x</span></div>
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

  const field = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s' } as const
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = GREEN }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#e2e8f0' }
  const label = { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 } as const
  const section = { fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 } as const

  return (
    <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-ui)' }}>

      <style jsx>{`
        .scene { perspective: 1000px; }
        .tilt {
          transform-style: preserve-3d;
          transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
          will-change: transform;
        }
        .slide { transform-style: preserve-3d; animation: slide-in 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        .depth-1 { transform: translateZ(26px); }
        .depth-2 { transform: translateZ(44px); }
        .depth-3 { transform: translateZ(72px); }
        @keyframes slide-in {
          from { opacity: 0; transform: translateZ(-70px) rotateY(10deg); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tilt { transition: none; }
          .slide { animation: none; }
        }
        /* The panel is presentation only — it stands down on small screens so the
           form gets the full width. !important overrides the inline display. */
        @media (max-width: 900px) {
          .panel { display: none !important; }
          .form-pane { flex: 1 1 100% !important; }
        }
      `}</style>

      {/* ── LEFT: Dark panel ── */}
      <div className="panel" style={{
        flex: '0 0 52%',
        background: `radial-gradient(ellipse 90% 70% at 50% 30%, rgba(22,166,121,0.15) 0%, transparent 65%), linear-gradient(160deg, ${DARK} 0%, #0d1a2e 100%)`,
        display: 'flex', flexDirection: 'column',
        padding: '44px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        {/* Corner wordmark — hidden while the logo slide is showing, so the mark
            is never on screen twice at two sizes. */}
        <div style={{ position: 'relative', opacity: slide.kind === 'logo' ? 0 : 1, transition: 'opacity 0.4s' }}>
          <span style={{ fontWeight: 800, fontSize: 25, color: '#fff', letterSpacing: '-0.7px' }}>
            Bake<span style={{ color: GREEN }}>x</span>
          </span>
        </div>

        <div
          className="scene"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}
          onMouseMove={tilt.onMove}
          onMouseLeave={tilt.onLeave}
        >
          <div ref={tilt.ref} className="tilt">
            {slide.kind === 'logo' ? (
              <div key="logo" className="slide" style={{ position: 'relative' }}>
                {/* Behind and further back, so it parallaxes against the wordmark
                    instead of travelling with it. */}
                <div style={{
                  position: 'absolute', top: '50%', right: '-8%',
                  width: 520, height: 320, transform: 'translateY(-55%) translateZ(-70px)',
                  background: `radial-gradient(ellipse, rgba(22,166,121,0.28) 0%, transparent 68%)`,
                  pointerEvents: 'none',
                }} />
                <div className="depth-3" style={{ position: 'relative' }}>
                  <div style={{
                    fontWeight: 800,
                    fontSize: 'clamp(64px, 11vw, 148px)',
                    lineHeight: 0.95,
                    color: '#fff',
                    letterSpacing: '-5px',
                    direction: 'ltr',
                    textShadow: '0 24px 60px rgba(0,0,0,0.55)',
                  }}>
                    Bake<span style={{ color: GREEN }}>x</span>
                  </div>
                </div>
                <div className="depth-1" style={{ position: 'relative', marginTop: 26 }}>
                  <div style={{ height: 3, width: 72, background: GREEN, borderRadius: 99, marginBottom: 22, boxShadow: `0 0 18px ${GREEN}` }} />
                  <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, maxWidth: 400 }}>
                    {slide.tagline}
                  </p>
                </div>
              </div>
            ) : (
              <div key={slideIdx} className="slide">
                <div className="depth-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,166,121,0.12)', border: '1px solid rgba(22,166,121,0.28)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 28, width: 'fit-content' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
                  {slide.badge}
                </div>
                <h2 className="depth-2" style={{ fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20 }}>
                  {slide.title}
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.85, maxWidth: 400 }}>
                  {slide.desc}
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { setSlideIdx(i); setHeld(true) }}
              aria-label={`${i + 1} / ${SLIDES.length}`}
              style={{ height: 4, width: i === slideIdx ? 32 : 16, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === slideIdx ? GREEN : 'rgba(255,255,255,0.2)', transition: 'all 0.3s', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Form ── */}
      <div className="form-pane" style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', position: 'relative', overflowY: 'auto' }}>

        <button onClick={() => router.push('/')}
          style={{ position: 'absolute', top: 20, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#64748b', fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          الرئيسية
        </button>

        <div style={{ width: '100%', maxWidth: 420 }}>

          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.8px', marginBottom: 6 }}>أنشئ مخبزك</div>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>شهر تجريبي كامل — بدون بطاقة ائتمان</div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form method="POST" action="/api/users/create-bakery" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            <div style={section}>معلومات المخبز</div>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>اسم المخبز</label>
              <input name="bakery_name" type="text" required placeholder="مثال: مخبز الأصيل"
                style={field} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ ...section, marginTop: 8 }}>حساب المدير</div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>الاسم</label>
              <input name="name" type="text" required placeholder="اسمك الكامل"
                style={field} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>اسم المستخدم</label>
              <input name="username" type="text" required placeholder="admin" dir="ltr"
                style={field} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>
                البريد الإلكتروني
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginRight: 6 }}>(للتواصل واسترجاع الحساب)</span>
              </label>
              <input name="email" type="email" required placeholder="example@email.com" dir="ltr"
                style={field} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>
                رقم الجوال
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginRight: 6 }}>(واتساب للدعم الفني)</span>
              </label>
              <input name="phone" type="tel" required placeholder="05xxxxxxxx" dir="ltr"
                style={field} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={label}>كلمة المرور</label>
              <input name="password" type="password" required placeholder="6 أحرف على الأقل" dir="ltr" minLength={6}
                style={field} onFocus={focus} onBlur={blur} />
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
