import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { requirePage, isRedirect } from '../lib/auth'
import { supabaseAdmin } from '../lib/supabase'
import Layout from '../components/Layout'
import { MetricCard, Icons, EditIcon, TrashIcon } from '../components/Metric'
import { T, ROLE_CONFIG } from '../lib/translations'
import { useLang } from '../lib/useLang'

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
  admin:    { ar: 'مدير عام',  en: 'Admin'     },
  manager:  { ar: 'مدير',      en: 'Manager'   },
  staff:    { ar: 'موظف',      en: 'Staff'     },
  readonly: { ar: 'قراءة فقط', en: 'Read Only' },
}

export default function UsersPage({ user, initialUsers }: any) {
  const { lang, setLang } = useLang()
  const [users, setUsers] = useState<any[]>(initialUsers || [])
  const [editing, setEditing] = useState<any>(null)
  const [editRole, setEditRole] = useState<any>('staff')
  const [editPerms, setEditPerms] = useState<any>({})
  const t = T[lang]

  const pendingUsers = users.filter(u => u.status === 'pending')
  const activeUsers = users.filter(u => u.status !== 'pending' && u.status !== 'rejected')

  const startEdit = (u: any) => {
    setEditing(u)
    setEditRole(u.role || 'staff')
    setEditPerms(u.perms || {})
  }

  const approve = async (u: any) => {
    const role = 'staff'
    const perms = ROLE_CONFIG.staff.defaultPerms
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, role, perms, status: 'active' })
    })
    setUsers(users.map(x => x.id === u.id ? { ...x, status: 'active', role, perms } : x))
  }

  const reject = async (u: any) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, status: 'rejected' })
    })
    setUsers(users.filter(x => x.id !== u.id))
  }

  const saveEdit = async () => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, role: editRole, perms: editPerms, status: 'active' })
    })
    setUsers(users.map(x => x.id === editing.id ? { ...x, role: editRole, perms: editPerms, status: 'active' } : x))
    setEditing(null)
  }

  const setRoleAndDefaults = (r: typeof ROLES[number]) => {
    setEditRole(r)
    setEditPerms({ ...ROLE_CONFIG[r].defaultPerms })
  }

  const deleteUser = async (id: string) => {
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setUsers(users.filter(u => u.id !== id))
  }

  return (
    <Layout user={user} lang={lang} setLang={setLang}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <MetricCard
            label={lang === 'ar' ? 'الحسابات النشطة' : 'Active Accounts'}
            value={activeUsers.length}
            sub={lang === 'ar' ? 'مستخدم لديه صلاحية دخول' : 'users with access'}
            icon={Icons.users} tone="green"
          />
          <MetricCard
            label={lang === 'ar' ? 'طلبات معلّقة' : 'Pending Requests'}
            value={pendingUsers.length}
            sub={lang === 'ar' ? 'بانتظار الموافقة' : 'awaiting approval'}
            icon={Icons.clock} tone="amber"
            valueColor={pendingUsers.length ? '#d97706' : undefined}
          />
          <MetricCard
            label={lang === 'ar' ? 'المديرون' : 'Administrators'}
            value={activeUsers.filter(u => u.role === 'admin' || u.role === 'manager').length}
            sub={lang === 'ar' ? 'صلاحيات إدارية' : 'with admin rights'}
            icon={Icons.shield} tone="violet"
          />
        </div>

        {/* Pending requests */}
        {pendingUsers.length > 0 && (
          <div className="card" style={{ borderColor: '#fde68a' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>
              <span style={{ background: '#fffbeb', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {pendingUsers.length}
              </span>
              {lang === 'ar' ? 'طلبات إنشاء الحسابات المعلقة' : 'Pending Account Requests'}
            </div>
            {pendingUsers.map(u => (
              <div key={u.id} className="trow" style={{ gridTemplateColumns: '34px 1fr auto', gap: 10, margin: '0 -18px', paddingInline: 18 }}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: '#fffbeb', color: '#92400e' }}>
                  {u.name?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9ca3af' }}>@{u.username}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => approve(u)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    {lang === 'ar' ? 'موافقة' : 'Approve'}
                  </button>
                  <button onClick={() => reject(u)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                    {lang === 'ar' ? 'رفض' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="card" style={{ border: '1.5px solid #16a679' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title">
                {lang === 'ar' ? 'تعديل صلاحيات' : 'Edit permissions'}: {editing.name}
              </div>
              <button onClick={() => setEditing(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>{lang === 'ar' ? 'الدور' : 'Role'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ROLES.map(r => {
                  const rc = ROLE_CONFIG[r]; const sel = r === editRole
                  return (
                    <button key={r} onClick={() => setRoleAndDefaults(r)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontFamily: 'inherit', fontWeight: sel ? 500 : 400, background: sel ? rc.bg : 'transparent', color: sel ? rc.color : '#888', borderColor: sel ? rc.color : '#d4d4d4' }}>
                      {ROLE_LABELS[r][lang]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</div>
              {Object.entries(PERM_LABELS).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #e5e5e5', fontSize: 13 }}>
                  <span>{v[lang]}</span>
                  <button className={`switch ${editPerms[k] ? 'on' : ''}`} onClick={() => setEditPerms({ ...editPerms, [k]: !editPerms[k] })} />
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} onClick={saveEdit}>
              {lang === 'ar' ? 'حفظ' : 'Save'}
            </button>
          </div>
        )}

        {/* Active users */}
        <div className="tbl">
          <div className="thead" style={{ gridTemplateColumns: '34px 1fr auto 64px', gap: 10 }}>
            <span></span>
            <span>{lang === 'ar' ? 'المستخدم' : 'User'}</span>
            <span>{lang === 'ar' ? 'الدور' : 'Role'}</span>
            <span></span>
          </div>
          {activeUsers.length === 0 ? (
            <div className="tbl-empty">{lang === 'ar' ? 'لا توجد حسابات نشطة' : 'No active accounts'}</div>
          ) : activeUsers.map(u => {
            const rc = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]
            const permCount = Object.values(u.perms || {}).filter(Boolean).length
            const locked = u.role === 'admin'
            return (
              <div key={u.id} className="trow" style={{ gridTemplateColumns: '34px 1fr auto 64px', gap: 10 }}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: rc?.bg, color: rc?.color }}>
                  {u.name?.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9ca3af' }}>@{u.username} · {permCount} {lang === 'ar' ? 'صلاحية' : 'permissions'}</div>
                </div>
                <span className="tag" style={{ background: rc?.bg, color: rc?.color }}>{ROLE_LABELS[u.role]?.[lang]}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="ibtn ibtn-edit" onClick={() => startEdit(u)} disabled={locked} title={lang === 'ar' ? 'تعديل' : 'Edit'}><EditIcon /></button>
                  <button className="ibtn ibtn-del" onClick={() => deleteUser(u.id)} disabled={locked} title={lang === 'ar' ? 'حذف' : 'Delete'}><TrashIcon /></button>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const guard = await requirePage(req as any, { anyPerm: ['users'] })
  if (isRedirect(guard)) return guard
  const { user } = guard
  const bid = user.bakery_id
  const { data } = bid
    ? await supabaseAdmin.from('users').select('id,name,username,role,perms,status,created_at').eq('bakery_id', bid).order('created_at')
    : await supabaseAdmin.from('users').select('id,name,username,role,perms,status,created_at').order('created_at')
  return { props: { user, initialUsers: data || [] } }
}
