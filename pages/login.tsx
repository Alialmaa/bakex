import { useState } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { useLang } from '../lib/useLang'

const G = '#16a679'
const GD = '#0d7a5a'
const DARK = '#0b0f1a'

const FEATURES = [
  { badge: 'كاشير احترافي', title: 'فواتير في ثوانٍ', desc: 'واجهة كاشير سريعة تعمل على أي جهاز — جوال، تابلت، أو كمبيوتر — بدون تعقيد.' },
  { badge: 'مخزون ذكي', title: 'تتبع كل مادة خام', desc: 'خصم تلقائي من المخزون مع كل بيع، وتنبيهات فورية عند نفاد المواد.' },
  { badge: 'تقارير تفصيلية', title: 'قرارات مبنية على بيانات', desc: 'تقارير يومية وشهرية للمبيعات والأرباح والتكاليف بضغطة واحدة.' },
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
  const isAR = lang === 'ar'
  const feat = FEATURES[featureIdx]

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
    <div dir={isAR ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── LEFT: Dark panel ── */}
      <div style={{
        flex: '0 0 52%',
        background: `radial-gradient(ellipse 90% 70% at 50% 30%, rgba(22,166,121,0.15) 0%, transparent 65%), linear-gradient(160deg, #0b0f1a 0%, #0d1a2e 100%)`,
        display: 'flex', flexDirection: 'column',
        padding: '44px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{ width: 36, height: 36, background: G, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.3px' }}>
            Bake<span style={{ color: G }}>x</span>
          </span>
        </div>

        {/* Feature content — grows to fill */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,166,121,0.12)', border: '1px solid rgba(22,166,121,0.28)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 28, width: 'fit-content' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}` }} />
            {feat.badge}
          </div>

          <h2 style={{ fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20 }}>
            {feat.title}
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.85, maxWidth: 400 }}>
            {feat.desc}
          </p>
        </div>

        {/* Slide indicators */}
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {FEATURES.map((_, i) => (
            <button key={i} onClick={() => setFeatureIdx(i)}
              style={{ height: 4, width: i === featureIdx ? 32 : 16, borderRadius: 99, border: 'none', cursor: 'pointer', background: i === featureIdx ? G : 'rgba(255,255,255,0.2)', transition: 'all 0.3s', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', position: 'relative' }}>

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
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 8 }}>أدخل كود الدخول</div>
                <div style={{ fontSize: 14, color: '#94a3b8' }}>الكود الخاص بمنشأتك — تواصل مع المدير للحصول عليه</div>
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
                {loading ? '...' : 'تأكيد'}
              </button>

              <button onClick={() => { setStep('credentials'); setAccessCode(''); setError('') }}
                style={{ width: '100%', background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 11, padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                ← رجوع
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (user) return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
