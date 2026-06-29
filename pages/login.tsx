import { useState } from 'react'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { useLang } from '../lib/useLang'

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isAR = lang === 'ar'

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
      if (res.ok) { window.location.href = '/dashboard' }
      else setError(data.error || (isAR ? 'بيانات غير صحيحة' : 'Invalid credentials'))
    } finally { setLoading(false) }
  }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: '#1D9E75', borderRadius: 14, marginBottom: 12, fontSize: 24 }}>🍞</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Bake<span style={{ color: '#1D9E75' }}>x</span></div>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.07em' }}>BAKERY MANAGEMENT</div>
        </div>

        <div className="card" style={{ padding: '28px 32px' }}>
          <div style={{ fontSize: 16, fontWeight: 500, textAlign: 'center', marginBottom: 4 }}>
            {isAR ? 'تسجيل الدخول' : 'Login'}
          </div>
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20 }}>
            {isAR ? 'أدخل بياناتك للوصول إلى النظام' : 'Enter your credentials to access the system'}
          </div>

          {error && <div className="alert alert-error">⚠ {error}</div>}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>{isAR ? 'اسم المستخدم' : 'Username'}</div>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={isAR ? 'اسم المستخدم' : 'Username'} dir="ltr" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>{isAR ? 'كلمة المرور' : 'Password'}</div>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', [isAR ? 'left' : 'right']: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={handleLogin} disabled={loading}>
            {loading ? '...' : (isAR ? 'دخول' : 'Login')}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {(['ar','en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '0.5px solid', cursor: 'pointer', background: lang===l?'#1D9E75':'transparent', color: lang===l?'#fff':'#888', borderColor: lang===l?'#1D9E75':'#d4d4d4' }}>
              {l === 'ar' ? 'ع' : 'EN'}
            </button>
          ))}
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
