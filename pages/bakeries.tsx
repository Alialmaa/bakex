import type { GetServerSideProps } from 'next'
import { useState } from 'react'
import { getUser } from '../lib/auth'
import { listBakeries } from '../lib/db/bakeries'
import Layout from '../components/Layout'
import { useLang } from '../lib/useLang'

interface Bakery { id: string; name: string; code: string; created_at: string; user_count: number }
interface Props { user: any; bakeries: Bakery[] }

export default function BakeriesPage({ user, bakeries: initial }: Props) {
  const { lang, setLang } = useLang()
  const isAR = lang === 'ar'
  const [bakeries, setBakeries] = useState(initial)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/bakeries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      const data = await res.json()
      if (res.ok) { setBakeries(b => [...b, { ...data, user_count: 0 }]); setNewName('') }
      else setError(data.error)
    } finally { setLoading(false) }
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>🏪 {isAR ? 'إدارة البيكريات' : 'Bakery Management'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{bakeries.length} {isAR ? 'بيكري' : 'bakeries'}</div>
        </div>

        {/* Add new */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{isAR ? '+ إضافة بيكري جديدة' : '+ Add New Bakery'}</div>
          {error && <div className="alert alert-error">⚠ {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={isAR ? 'اسم البيكري' : 'Bakery name'}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !newName.trim()}>
              {loading ? '...' : isAR ? 'إنشاء' : 'Create'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f8f6', borderBottom: '0.5px solid #e5e5e5' }}>
                <th style={{ padding: '10px 14px', textAlign: isAR ? 'right' : 'left', fontWeight: 500 }}>{isAR ? 'اسم البيكري' : 'Name'}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 500 }}>{isAR ? 'الكود' : 'Code'}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 500 }}>{isAR ? 'المستخدمون' : 'Users'}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 500 }}>{isAR ? 'تاريخ الإنشاء' : 'Created'}</th>
              </tr>
            </thead>
            <tbody>
              {bakeries.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: '0.5px solid #f0f0ee', background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{b.name}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'monospace', letterSpacing: 2, background: '#E1F5EE', color: '#085041', padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>{b.code}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#555' }}>{b.user_count}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#888' }}>
                    {new Date(b.created_at).toLocaleDateString(isAR ? 'ar-SA' : 'en')}
                  </td>
                </tr>
              ))}
              {bakeries.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#888' }}>{isAR ? 'لا توجد بيكريات بعد' : 'No bakeries yet'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (user.role !== 'super_admin') return { redirect: { destination: '/', permanent: false } }

  const bakeries = await listBakeries()
  return { props: { user, bakeries } }
}
