import type { GetServerSideProps } from 'next'
import { useState } from 'react'
import { requirePage, isRedirect } from '../lib/auth'
import { listBakeries, getBakeryUserCount } from '../lib/db/bakeries'
import Layout from '../components/Layout'
import { useLang } from '../lib/useLang'
import { fmtDate } from '../lib/datetime'

const GREEN = '#16a679'

interface Bakery {
  id: string
  name: string
  code: string
  access_code: string | null
  created_at: string
  user_count: number
  subscription_status: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000))
}

function resolveStatus(b: Bakery): 'active' | 'trial' | 'expired' | 'unknown' {
  const raw = b.subscription_status
  if (raw === 'active') {
    return daysLeft(b.subscription_ends_at) > 0 ? 'active' : 'expired'
  }
  if (raw === 'trial' || !raw) {
    return daysLeft(b.trial_ends_at) > 0 ? 'trial' : 'expired'
  }
  return 'expired'
}

function StatusBadge({ bakery }: { bakery: Bakery }) {
  const status = resolveStatus(bakery)
  const left = status === 'active'
    ? daysLeft(bakery.subscription_ends_at)
    : daysLeft(bakery.trial_ends_at)

  const cfg = {
    active:  { bg: 'rgba(22,166,121,0.1)', color: GREEN,    border: 'rgba(22,166,121,0.3)', label: 'نشط' },
    trial:   { bg: '#fef3c7',              color: '#92400e', border: '#fde68a',              label: 'تجربة' },
    expired: { bg: '#fef2f2',              color: '#dc2626', border: '#fecaca',              label: 'منتهي' },
    unknown: { bg: '#f3f4f6',              color: '#6b7280', border: '#e5e7eb',              label: '—' },
  }[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700,
      }}>
        {cfg.label}
      </span>
      {status !== 'expired' && status !== 'unknown' && left > 0 && (
        <span style={{ fontSize: 11, color: '#888' }}>{left} يوم</span>
      )}
    </div>
  )
}

export default function BakeriesPage({ user, bakeries: initial }: { user: any; bakeries: Bakery[] }) {
  const { lang, setLang } = useLang()
  const isAR = lang === 'ar'
  const [bakeries, setBakeries] = useState(initial)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editCodeId, setEditCodeId] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeSaving, setCodeSaving] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/bakeries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const data = await res.json()
      if (res.ok) {
        setBakeries(b => [...b, {
          ...data,
          user_count: 0,
          subscription_status: 'trial',
          trial_ends_at: data.trial_ends_at,
          subscription_ends_at: null,
        }])
        setNewName('')
      } else setError(data.error)
    } finally { setCreating(false) }
  }

  const handleAction = async (id: string, action: 'activate' | 'extend_trial' | 'expire') => {
    if (action === 'expire' && confirmId !== id) {
      setConfirmId(id)
      return
    }
    setConfirmId(null)
    setLoadingId(id)
    try {
      const res = await fetch('/api/bakeries', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        const now = Date.now()
        setBakeries(bs => bs.map(b => {
          if (b.id !== id) return b
          if (action === 'activate') return { ...b, subscription_status: 'active', subscription_ends_at: new Date(now + 365 * 86_400_000).toISOString() }
          if (action === 'extend_trial') return { ...b, subscription_status: 'trial', trial_ends_at: new Date(now + 30 * 86_400_000).toISOString(), subscription_ends_at: null }
          return { ...b, subscription_status: 'expired', trial_ends_at: new Date(now - 1).toISOString(), subscription_ends_at: null }
        }))
      }
    } finally { setLoadingId(null) }
  }

  const handleSetAccessCode = async (id: string, code: string | null) => {
    setCodeSaving(true)
    try {
      const res = await fetch('/api/bakeries', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'set_access_code', access_code: code }),
      })
      if (res.ok) {
        setBakeries(bs => bs.map(b => b.id === id ? { ...b, access_code: code || null } : b))
        setEditCodeId(null)
        setCodeInput('')
      }
    } finally { setCodeSaving(false) }
  }

  const generateAccessCode = () => {
    const chars = '0123456789'
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return `${part()}-${part()}`
  }

  const counts = {
    active:  bakeries.filter(b => resolveStatus(b) === 'active').length,
    trial:   bakeries.filter(b => resolveStatus(b) === 'trial').length,
    expired: bakeries.filter(b => resolveStatus(b) === 'expired').length,
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'الكل', value: bakeries.length, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
            { label: 'نشطة', value: counts.active, color: GREEN, bg: 'rgba(22,166,121,0.08)', border: 'rgba(22,166,121,0.25)' },
            { label: 'تجربة', value: counts.trial, color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
            { label: 'منتهية', value: counts.expired, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '12px 20px', minWidth: 90, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {isAR ? '+ إضافة بيكري جديدة' : '+ Add New Bakery'}
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>⚠ {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={isAR ? 'اسم البيكري' : 'Bakery name'}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? '...' : isAR ? 'إنشاء' : 'Create'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f8f6', borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600 }}>البيكري</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>الكود</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>كود الدخول</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>المستخدمون</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>تاريخ الإنشاء</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>الاشتراك</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {bakeries.map((b, i) => {
                  const status = resolveStatus(b)
                  const busy = loadingId === b.id
                  const confirming = confirmId === b.id
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f0f0ee', background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', letterSpacing: 2, background: '#E1F5EE', color: '#085041', padding: '3px 10px', borderRadius: 6 }}>
                          {b.code}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', minWidth: 180 }}>
                        {editCodeId === b.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              value={codeInput}
                              onChange={e => setCodeInput(e.target.value)}
                              placeholder="0000-0000"
                              dir="ltr"
                              style={{ width: 100, padding: '4px 8px', fontSize: 13, fontFamily: 'monospace', textAlign: 'center', borderRadius: 6, border: '1.5px solid #cbd5e1' }}
                            />
                            <button onClick={() => handleSetAccessCode(b.id, codeInput || null)} disabled={codeSaving}
                              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                              {codeSaving ? '...' : 'حفظ'}
                            </button>
                            <button onClick={() => { setEditCodeId(null); setCodeInput('') }}
                              style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                            {b.access_code ? (
                              <span style={{ fontFamily: 'monospace', letterSpacing: 2, background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>
                                {b.access_code}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>غير محدد</span>
                            )}
                            <button
                              onClick={() => { setEditCodeId(b.id); setCodeInput(b.access_code || '') }}
                              title="تعديل كود الدخول"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, fontSize: 14 }}>
                              ✏️
                            </button>
                            <button
                              onClick={() => { const c = generateAccessCode(); handleSetAccessCode(b.id, c) }}
                              title="توليد كود عشوائي"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, fontSize: 14 }}>
                              🎲
                            </button>
                            {b.access_code && (
                              <button
                                onClick={() => handleSetAccessCode(b.id, null)}
                                title="حذف كود الدخول"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 2, fontSize: 14 }}>
                                🗑️
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#555' }}>{b.user_count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#888' }}>
                        {fmtDate(b.created_at, 'ar')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <StatusBadge bakery={b} />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {confirming ? (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#dc2626' }}>تأكيد الإيقاف؟</span>
                            <button onClick={() => handleAction(b.id, 'expire')}
                              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                              نعم
                            </button>
                            <button onClick={() => setConfirmId(null)}
                              style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                              لا
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {/* Activate 1 year */}
                            <button
                              onClick={() => handleAction(b.id, 'activate')}
                              disabled={busy}
                              title="تفعيل اشتراك سنة كاملة"
                              style={{
                                background: status === 'active' ? 'rgba(22,166,121,0.1)' : GREEN,
                                color: status === 'active' ? GREEN : '#fff',
                                border: `1.5px solid ${status === 'active' ? 'rgba(22,166,121,0.3)' : GREEN}`,
                                borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                                fontFamily: 'inherit', fontWeight: 600, opacity: busy ? 0.5 : 1,
                              }}>
                              {busy ? '...' : status === 'active' ? '✓ تجديد سنة' : 'تفعيل سنة'}
                            </button>

                            {/* Extend trial 30 days */}
                            <button
                              onClick={() => handleAction(b.id, 'extend_trial')}
                              disabled={busy}
                              title="تمديد التجربة 30 يوم"
                              style={{
                                background: '#fef3c7', color: '#92400e',
                                border: '1.5px solid #fde68a',
                                borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                                fontFamily: 'inherit', fontWeight: 600, opacity: busy ? 0.5 : 1,
                              }}>
                              +30 يوم
                            </button>

                            {/* Expire */}
                            {status !== 'expired' && (
                              <button
                                onClick={() => handleAction(b.id, 'expire')}
                                disabled={busy}
                                title="إيقاف الاشتراك فوراً"
                                style={{
                                  background: '#fef2f2', color: '#dc2626',
                                  border: '1.5px solid #fecaca',
                                  borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                                  fontFamily: 'inherit', fontWeight: 600, opacity: busy ? 0.5 : 1,
                                }}>
                                إيقاف
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {bakeries.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
                      لا توجد بيكريات بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
          تفعيل سنة = اشتراك 365 يوم من الآن &nbsp;·&nbsp; +30 يوم = تمديد التجربة المجانية &nbsp;·&nbsp; إيقاف = حجب الوصول فوراً
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { superAdminOnly: true })
  if (isRedirect(guard)) return guard
  const { user } = guard

  const rows = await listBakeries()
  const bakeries = await Promise.all(
    (rows || []).map(async (b: any) => ({
      ...b,
      user_count: await getBakeryUserCount(b.id),
    }))
  )
  return { props: { user, bakeries } }
}
