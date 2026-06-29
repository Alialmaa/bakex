import { useRouter } from 'next/router'
import { T, Lang, ROLE_CONFIG } from '../lib/translations'

// Clean SVG icons — no emojis
const Icon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 }
  const icons: Record<string, JSX.Element> = {
    dashboard: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    stock:     <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    purchases: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
    recipes:   <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    produce:   <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    sales:     <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    cost:      <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    reports:   <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    users:     <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    bakeries:  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    cashier:   <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    settings:  <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    logout:    <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  }
  return icons[name] || null
}

const NAV_LABELS: Record<string, { ar: string; en: string }> = {
  dashboard:  { ar: 'لوحة التحكم',     en: 'Dashboard' },
  stock:      { ar: 'المخزون',         en: 'Inventory' },
  purchases:  { ar: 'المشتريات',       en: 'Purchases' },
  recipes:    { ar: 'الوصفات',         en: 'Recipes' },
  produce:    { ar: 'الإنتاج',         en: 'Production' },
  sales:      { ar: 'المبيعات',        en: 'Sales' },
  cost:       { ar: 'حاسبة الكوست',   en: 'Cost Calc' },
  reports:    { ar: 'التقارير',        en: 'Reports' },
  users:      { ar: 'إدارة الحسابات', en: 'Users' },
  bakeries:   { ar: 'المنشآت',          en: 'Businesses' },
  settings:   { ar: 'الإعدادات',       en: 'Settings' },
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
  const isSuperAdmin = user?.role === 'super_admin'

  const allowed = Object.keys(NAV_LABELS).filter(k => {
    if (k === 'bakeries') return isSuperAdmin
    if (isSuperAdmin) return false
    if (k === 'cashier') return false
    if (k === 'settings') return user?.role === 'admin'
    if (k === 'recipes') return user?.perms?.produce
    if (k === 'purchases') return user?.perms?.stock
    return user?.perms?.[k]
  })

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const currentPage = router.pathname.replace('/', '') || 'dashboard'

  return (
    <div className="layout" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Sidebar */}
      <div className={`sidebar ${isRTL ? 'sidebar-rtl' : ''}`}>

        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'var(--green)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l19-9-9 19-2-8-8-2z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: '#111' }}>
                Bakex
              </div>
              {user?.bakery_name
                ? <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.bakery_name}</div>
                : <div style={{ fontSize: 10, color: 'var(--gray-400)', letterSpacing: '0.05em' }}>BAKERY MGMT</div>
              }
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {allowed.map(k => (
            <div
              key={k}
              className={`nav-item ${currentPage === k ? 'active' : ''}`}
              onClick={() => router.push(`/${k}`)}
            >
              <Icon name={k} size={16} />
              <span>{NAV_LABELS[k][lang]}</span>
            </div>
          ))}
        </nav>

        {/* User info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="avatar" style={{ width: 30, height: 30, background: rc?.bg || '#f3f4f6', color: rc?.color || '#374151', fontSize: 12 }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {t.roles[user?.role as keyof typeof t.roles]}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>
            {NAV_LABELS[currentPage]?.[lang] || NAV_LABELS.dashboard[lang]}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Lang toggle */}
            <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 8, padding: 3, gap: 2 }}>
              {(['ar', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '4px 10px', fontSize: 12, borderRadius: 6,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                  background: lang === l ? '#fff' : 'transparent',
                  color: lang === l ? 'var(--gray-700)' : 'var(--gray-400)',
                  boxShadow: lang === l ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {l === 'ar' ? 'ع' : 'EN'}
                </button>
              ))}
            </div>

            {/* Logout */}
            <button className="btn" onClick={handleLogout} style={{ fontSize: 13, padding: '6px 12px', gap: 6 }}>
              <Icon name="logout" size={14} />
              {t.logout}
            </button>
          </div>
        </div>

        <div className="content">{children}</div>
      </div>
    </div>
  )
}
