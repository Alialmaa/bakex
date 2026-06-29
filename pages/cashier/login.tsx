import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../../lib/auth'

const PURPLE = '#6C63FF'

export default function CashierLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!username || !password) { setError('أدخل اسم المستخدم وكلمة المرور'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok) {
        window.location.href = '/cashier'
      } else {
        setError(data.error || 'بيانات غير صحيحة')
      }
    } finally { setLoading(false) }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f0f0ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'inherit' }}>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: PURPLE, borderRadius: 16, marginBottom: 12, fontSize: 26 }}>🖥️</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: -0.5 }}>نظام الكاشير</div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>CASHIER SYSTEM</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 360, boxShadow: '0 4px 24px rgba(108,99,255,0.08)', border: '0.5px solid #ebe9ff' }}>
        {error && (
          <div style={{ background: '#FEF0F0', border: '0.5px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>اسم المستخدم</div>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="اسم المستخدم" dir="ltr"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>كلمة المرور</div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" dir="ltr"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            />
            <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14 }}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', background: PURPLE, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '...' : 'دخول →'}
        </button>
      </div>

      <button onClick={() => window.location.href = '/'}
        style={{ marginTop: 20, background: 'none', border: 'none', color: '#aaa', fontSize: 12, cursor: 'pointer' }}>
        ← العودة للرئيسية
      </button>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (user) return { redirect: { destination: '/cashier', permanent: false } }
  return { props: {} }
}
