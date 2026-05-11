import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getUser } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { T, Lang, ROLE_CONFIG } from '../lib/translations'

const PERM_LABELS: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  stock:     { ar: 'المخزون',     en: 'Inventory'  },
  produce:   { ar: 'الإنتاج',     en: 'Production' },
  sales:     { ar: 'المبيعات',    en: 'Sales'      },
  cost:      { ar: 'حاسبة الكوست', en: 'Cost Calc' },
  reports:   { ar: 'التقارير',    en: 'Reports'    },
  users:     { ar: 'إدارة الحسابات', en: 'Users'   },
}

const ROLES = ['admin', 'manager', 'staff', 'readonly'] as const
const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  admin:    { ar: 'مدير عام',   en: 'Admin'     },
  manager:  { ar: 'مدير',       en: 'Manager'   },
  staff:    { ar: 'موظف',       en: 'Staff'     },
  readonly: { ar: 'قراءة فقط',  en: 'Read Only' },
}

export default function UsersPage({ user, initialUsers }: any) {
  const [lang, setLang] = useState<Lang>('ar')
  const [users, setUsers] = useState<any[]>(initialUsers || [])
  const [showForm, setShowForm] = useState(false)
  const [role, setRole] = useState<typeof ROLES[number]>('staff')
  const [perms, setPerms] = useState({ ...ROLE_CONFIG.staff.defaultPerms })
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '', adminPass: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const t = T[lang]

  const setRolePerms = (r: typeof ROLES[number]) => {
    setRole(r)
    setPerms({ ...ROLE_CONFIG[r].defaultPerms })
  }

  const createUser = async () => {
    setError('')
    if (!form.name || !form.username || !form.password) return setError(t.err.required)
    if (form.password !== form.confirm) return setError(t.err.passMismatch)
    if (form.password.length < 3) return setError(t.err.passShort)
    setSaving(true)
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role, perms }),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers([...users, data.user])
      setShowForm(false)
      setForm({ name: '', username: '', password: '', confirm: '', adminPass: '' })
    } else {
      setError(data.error || 'Error')
    }
    setSaving(false)
  }

  const deleteUser = async (id: string) => {
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUsers(users.filter(u => u.id !== id))
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#888' }}>{lang === 'ar' ? `${users.length} حسابات` : `${users.length} accounts`}</div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ fontSize: 13 }}>
            {showForm ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? '+ إضافة موظف' : '+ Add Employee')}
          </button>
        </div>

        {/* Add user form */}
        {showForm && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{lang === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account'}</div>
            {error && <div className="alert alert-error">⚠ {error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { key: 'name', label: { ar: 'الاسم الكامل', en: 'Full Name' }, type: 'text' },
                { key: 'username', label: { ar: 'اسم المستخدم', en: 'Username' }, type: 'text' },
                { key: 'password', label: { ar: 'كلمة المرور', en: 'Password' }, type: 'password' },
                { key: 'confirm', label: { ar: 'تأكيد كلمة المرور', en: 'Confirm Password' }, type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>{f.label[lang]}</div>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>

            {/* Role */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 7 }}>{t.users.role}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ROLES.map(r => {
                  const rc = ROLE_CONFIG[r]
                  const sel = r === role
                  return (
                    <button key={r} onClick={() => setRolePerms(r)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', fontWeight: sel ? 500 : 400, background: sel ? rc.bg : 'transparent', color: sel ? rc.color : '#888', borderColor: sel ? rc.color : '#d4d4d4' }}>
                      {ROLE_LABELS[r][lang]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Permissions */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 8 }}>{t.users.permissions}</div>
              {Object.entries(PERM_LABELS).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                  <span>{v[lang]}</span>
                  <button className={`switch ${(perms as any)[k] ? 'on' : ''}`} onClick={() => setPerms({ ...perms, [k]: !(perms as any)[k] })} />
                </div>
              ))}
            </div>

            {/* Admin password */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 5 }}>{t.adminPassword}</div>
              <input type="password" value={form.adminPass} onChange={e => setForm({ ...form, adminPass: e.target.value })} />
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={createUser} disabled={saving}>
              {saving ? '...' : t.register}
            </button>
          </div>
        )}

        {/* Users list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto auto', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid #d4d4d4', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <span></span>
            <span>{lang === 'ar' ? 'المستخدم' : 'User'}</span>
            <span>{lang === 'ar' ? 'الدور' : 'Role'}</span>
            <span></span>
          </div>
          <div style={{ padding: '0 16px' }}>
            {users.map(u => {
              const rc = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]
              const permCount = Object.values(u.perms || {}).filter(Boolean).length
              return (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto auto', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                  <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: rc?.bg, color: rc?.color }}>
                    {u.name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>@{u.username} · {permCount} {lang === 'ar' ? 'صلاحية' : 'permissions'}</div>
                  </div>
                  <span className="tag" style={{ background: rc?.bg, color: rc?.color }}>{ROLE_LABELS[u.role]?.[lang]}</span>
                  <button
                    onClick={() => deleteUser(u.id)}
                    disabled={u.role === 'admin'}
                    style={{ background: 'none', border: 'none', cursor: u.role === 'admin' ? 'not-allowed' : 'pointer', color: '#E24B4A', opacity: u.role === 'admin' ? 0.3 : 1, fontSize: 16, padding: 4 }}
                  >🗑</button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const user = getUser(req as any)
  if (!user) return { redirect: { destination: '/login', permanent: false } }
  if (!user.perms?.users) return { redirect: { destination: '/', permanent: false } }
  const { data } = await supabaseAdmin.from('users').select('id,name,username,role,perms,created_at').order('created_at')
  return { props: { user, initialUsers: data || [] } }
}
