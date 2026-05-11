import { useRouter } from 'next/router'
import { T, Lang, ROLE_CONFIG } from '../lib/translations'

const NAV_ICONS: Record<string, string> = {
  dashboard: '⊞', stock: '📦', recipes: '📋', produce: '🍞', sales: '🛒', cost: '🧮', reports: '📊', users: '👥'
}

const NAV_LABELS: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  stock:     { ar: 'المخزون',     en: 'Inventory' },
  recipes:   { ar: 'الوصفات',     en: 'Recipes' },
  produce:   { ar: 'الإنتاج',     en: 'Production' },
  sales:     { ar: 'المبيعات',    en: 'Sales' },
  cost:      { ar: 'حاسبة الكوست', en: 'Cost Calc' },
  reports:   { ar: 'التقارير',    en: 'Reports' },
  users:     { ar: 'إدارة الحسابات', en: 'Users' },
}

interface LayoutProps {
  children: React.ReactNode
  user: any
  lang: Lang
  setLang: (l: Lang) => void
}

export default function Layout({ children, user, lang, setLang }: LayoutProps) {
  const router = useRouter()
  const t = T[lang]
  const rc = ROLE_CONFIG[user?.role as keyof typeof ROLE_CONFIG]
  const isRTL = lang === 'ar'

  // recipes permission piggybacks on 'produce' permission
  const allowed = Object.keys(NAV_LABELS).filter(k => {
    if (k === 'recipes') return user?.perms?.produce
    return user?.perms?.[k]
  })

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const currentPage = router.pathname.replace('/', '') || 'dashboard'

  return (
    <div className="layout" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`sidebar ${isRTL ? 'sidebar-rtl' : ''}`}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid #e5e5e5', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🍞</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.5 }}>
                Bake<span style={{ color: '#1D9E75' }}>x</span>
              </div>
              <div style={{ fontSize: 9, color: '#888', letterSpacing: '0.06em' }}>BAKERY MANAGEMENT</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '4px 0' }}>
          {allowed.map(k => (
            <div
              key={k}
              className={`nav-item ${currentPage === k ? 'active' : ''}`}
              onClick={() => router.push(k === 'dashboard' ? '/' : `/${k}`)}
            >
              <span style={{ fontSize: 15 }}>{NAV_ICONS[k]}</span>
              {NAV_LABELS[k][lang]}
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e5e5e5' }}>
          <div style={{ fontSize: 10, color: '#aaa' }}>Bakex v1.0</div>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
            {NAV_LABELS[currentPage]?.[lang] || NAV_LABELS.dashboard[lang]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['ar', 'en'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 6,
                    border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit',
                    background: lang === l ? '#1D9E75' : 'transparent',
                    color: lang === l ? '#fff' : '#888',
                    borderColor: lang === l ? '#1D9E75' : '#d4d4d4',
                  }}
                >{l === 'ar' ? 'ع' : 'EN'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: rc?.bg, color: rc?.color }}>
                {user?.name?.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>
                  {t.roles[user?.role as keyof typeof t.roles]}
                </div>
              </div>
            </div>
            <button className="btn" onClick={handleLogout} style={{ fontSize: 12, padding: '5px 10px' }}>
              {t.logout}
            </button>
          </div>
        </div>

        <div className="content">{children}</div>
      </div>
    </div>
  )
}
