import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { hasValidSession } from '../lib/auth'
import { useLang } from '../lib/useLang'
import { useTilt } from '../lib/useTilt'

const G = '#16a679'
const GD = '#0d7a5a'
const DARK = '#0b0f1a'

/**
 * Three slides on the dark panel: the wordmark, then two hooks.
 *
 * The wordmark carries the first slide on its own at display size — a brand
 * moment before any sales copy. Both hooks describe something the system
 * actually does, so nothing here can be contradicted by using the product.
 */
type Slide =
  | { kind: 'logo'; tagline: Bilingual }
  | { kind: 'hook'; badge: Bilingual; title: Bilingual; desc: Bilingual }

type Bilingual = { ar: string; en: string }

const SLIDES: Slide[] = [
  {
    kind: 'logo',
    tagline: {
      ar: 'من المخزون إلى الكاشير إلى التقارير — في نظام واحد',
      en: 'Inventory, till and reports — in one system',
    },
  },
  {
    kind: 'hook',
    badge: { ar: 'حساب التكاليف', en: 'Cost Control' },
    title: { ar: 'اعرف ربح كل قطعة', en: 'Know every unit’s profit' },
    desc: {
      ar: 'كوست كل وصفة يُحسب من مكوّناتها وأسعار مشترياتك — فترى الهامش الحقيقي لكل منتج، لا التخمين.',
      en: 'Each recipe is costed from its ingredients and your purchase prices, so you see the real margin per product instead of guessing.',
    },
  },
  {
    kind: 'hook',
    badge: { ar: 'مخزون ذكي', en: 'Smart Inventory' },
    title: { ar: 'كل فاتورة تنزل من المخزون', en: 'Every invoice moves stock' },
    desc: {
      ar: 'الخصم يحدث لحظة البيع، وتنبيهك يوصل قبل ما تنفد المادة — بدون جرد يدوي في آخر اليوم.',
      en: 'Stock moves the moment you sell, and you are warned before an ingredient runs out — no end-of-day count.',
    },
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useLang()
  const [mode, setMode] = useState<'system' | 'cashier'>('system')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [featureIdx, setFeatureIdx] = useState(0)
  const [held, setHeld] = useState(false)
  const isAR = lang === 'ar'
  const slide = SLIDES[featureIdx]
  const fl = isAR ? 'ar' : 'en'
  const tilt = useTilt(7)

  // Advances on its own so the panel is not a still image, and stops for good
  // once the visitor picks a slide themselves.
  useEffect(() => {
    if (held) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setFeatureIdx(i => (i + 1) % SLIDES.length), 6000)
    return () => clearInterval(t)
  }, [held])

  const handleLogin = async () => {
    setError('')
    if (!username || !password) { setError(isAR ? 'أدخل اسم المستخدم وكلمة المرور' : 'Enter username and password'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok && data.needs_code) { setStep('code') }
      else if (res.ok) { window.location.href = mode === 'cashier' ? '/cashier' : '/dashboard' }
      else { setError(data.error || (isAR ? 'بيانات غير صحيحة' : 'Invalid credentials')) }
    } finally { setLoading(false) }
  }

  const handleCodeSubmit = async () => {
    setError('')
    if (!accessCode.trim()) { setError('أدخل كود الدخول'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, access_code: accessCode.trim() })
      })
      const data = await res.json()
      if (res.ok && !data.needs_code) { window.location.href = mode === 'cashier' ? '/cashier' : '/dashboard' }
      else { setError(data.error || 'كود الدخول غير صحيح') }
    } finally { setLoading(false) }
  }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-ui)' }}>

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
        /* The two panels had no breakpoint, so on a phone they sat side by side
           and the login form was clipped to about half a screen. The dark panel
           is presentation only — it stands down and the form takes the width.
           !important because the display it overrides is an inline style. */
        @media (max-width: 900px) {
          .panel { display: none !important; }
          .form-pane { flex: 1 1 100% !important; }
        }
      `}</style>

      {/* ── LEFT: Dark panel ── */}
      <div className="panel" style={{
        flex: '0 0 52%',
        background: `radial-gradient(ellipse 90% 70% at 50% 30%, rgba(22,166,121,0.15) 0%, transparent 65%), linear-gradient(160deg, #0b0f1a 0%, #0d1a2e 100%)`,
        display: 'flex', flexDirection: 'column',
        padding: '44px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        {/* Small corner wordmark — stood down while the logo slide is showing,
            so the mark is not on screen twice at two sizes. */}
        <div style={{ position: 'relative', opacity: slide.kind === 'logo' ? 0 : 1, transition: 'opacity 0.4s' }}>
          <span style={{ fontWeight: 800, fontSize: 25, color: '#fff', letterSpacing: '-0.7px' }}>
            Bake<span style={{ color: G }}>x</span>
          </span>
        </div>

        {/* Slide — the scene tilts toward the pointer, layers sit at depth */}
        <div
          className="scene"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}
          onMouseMove={tilt.onMove}
          onMouseLeave={tilt.onLeave}
        >
          <div ref={tilt.ref} className="tilt">
            {slide.kind === 'logo' ? (
              <div key="logo" className="slide" style={{ position: 'relative' }}>
                {/* Glow sits behind and further back, so it parallaxes against
                    the wordmark instead of moving with it. */}
                <div className="glow" style={{
                  position: 'absolute', top: '50%', [isAR ? 'right' : 'left']: '-8%',
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
                    Bake<span style={{ color: G }}>x</span>
                  </div>
                </div>
                <div className="depth-1" style={{ position: 'relative', marginTop: 26 }}>
                  <div style={{ height: 3, width: 72, background: G, borderRadius: 99, marginBottom: 22, boxShadow: `0 0 18px ${G}` }} />
                  <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, maxWidth: 400 }}>
                    {slide.tagline[fl]}
                  </p>
                </div>
              </div>
            ) : (
              <div key={featureIdx} className="slide">
                <div className="depth-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,166,121,0.12)', border: '1px solid rgba(22,166,121,0.28)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 28, width: 'fit-content' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}` }} />
                  {slide.badge[fl]}
                </div>

                <h2 className="depth-2" style={{ fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20 }}>
                  {slide.title[fl]}
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.85, maxWidth: 400 }}>
                  {slide.desc[fl]}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Slide indicators */}
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { setFeatureIdx(i); setHeld(true) }}
              aria-label={`${i + 1} / ${SLIDES.length}`}
              style={{ height: 4, width: i === featureIdx ? 32 : 16, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === featureIdx ? G : 'rgba(255,255,255,0.2)', transition: 'all 0.3s', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Form panel ── */}
      <div className="form-pane" style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', position: 'relative' }}>

        {/* Lang toggle — top */}
        <div style={{ position: 'absolute', top: 24, [isAR ? 'left' : 'right']: 24, display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['ar', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: lang === l ? '#fff' : 'transparent', color: lang === l ? '#111' : '#9ca3af', boxShadow: lang === l ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {l === 'ar' ? 'ع' : 'EN'}
            </button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>

          {step === 'credentials' ? (
            <>
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>
                  {isAR ? 'تسجيل الدخول' : 'Sign In'}
                </div>
                <div style={{ fontSize: 14, color: '#94a3b8' }}>
                  {isAR ? 'أدخل بيانات حسابك للمتابعة' : 'Enter your credentials to continue'}
                </div>
              </div>

              {/* Mode toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                {[
                  { key: 'system', labelAR: 'نظام الإدارة', labelEN: 'Management', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
                  { key: 'cashier', labelAR: 'الكاشير', labelEN: 'Cashier', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
                ].map(m => {
                  const active = mode === m.key
                  return (
                    <button key={m.key} onClick={() => setMode(m.key as any)}
                      style={{ padding: '12px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${active ? G : '#e5e7eb'}`, background: active ? '#f0fdf9' : '#fafafa', color: active ? GD : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: active ? 700 : 500, fontSize: 13.5, transition: 'all 0.15s' }}>
                      {m.icon}
                      {isAR ? m.labelAR : m.labelEN}
                    </button>
                  )
                })}
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{isAR ? 'اسم المستخدم' : 'Username'}</div>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder={isAR ? 'اسم المستخدم' : 'Username'} dir="ltr"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{isAR ? 'كلمة المرور' : 'Password'}</div>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" dir="ltr"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  <button onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', [isAR ? 'left' : 'right']: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 4 }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: isAR ? 'left' : 'right', marginBottom: 24 }}>
                <button onClick={() => router.push('/forgot-password')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: G, fontFamily: 'inherit', fontWeight: 500 }}>
                  {isAR ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>

              <button onClick={handleLogin} disabled={loading}
                style={{ width: '100%', background: loading ? '#9ca3af' : G, border: 'none', borderRadius: 11, padding: '13px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: loading ? 'none' : `0 4px 20px rgba(22,166,121,0.35)`, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = GD }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = G }}>
                {loading ? '...' : (isAR ? 'دخول' : 'Sign In')}
              </button>

              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: '#94a3b8' }}>
                {isAR ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
                <span onClick={() => router.push('/register')} style={{ color: G, fontWeight: 600, cursor: 'pointer' }}>
                  {isAR ? 'أنشئ مخبزك' : 'Get started'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 36 }}>
                <div style={{ width: 52, height: 52, background: '#f0fdf9', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>
                  {isAR ? 'أدخل كود الدخول' : 'Enter Access Code'}
                </div>
                <div style={{ fontSize: 14, color: '#94a3b8' }}>
                  {isAR ? 'الكود الخاص بمنشأتك — تواصل مع المدير للحصول عليه' : 'Your bakery access code — contact your manager if you don\'t have it'}
                </div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 18 }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <input type="text" value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                  placeholder="0000-0000" dir="ltr"
                  style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, letterSpacing: '0.15em' }}
                  autoFocus />
              </div>

              <button onClick={handleCodeSubmit} disabled={loading}
                style={{ width: '100%', background: loading ? '#9ca3af' : G, border: 'none', borderRadius: 11, padding: '13px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: loading ? 'none' : `0 4px 20px rgba(22,166,121,0.35)`, transition: 'all 0.15s', marginBottom: 16 }}>
                {loading ? '...' : (isAR ? 'تأكيد' : 'Confirm')}
              </button>

              <button onClick={() => { setStep('credentials'); setAccessCode(''); setError('') }}
                style={{ width: '100%', background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 11, padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                {isAR ? '→ رجوع' : '← Back'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (await hasValidSession(req as any))
    return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
