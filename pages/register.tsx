import { useState } from 'react'
import { useRouter } from 'next/router'
import { ROLE_CONFIG } from '../lib/translations'

const PERM_LABELS: Record<string, { ar: string, en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  stock:     { ar: 'المخزون',     en: 'Inventory'  },
  produce:   { ar: 'الإنتاج',     en: 'Production' },
  sales:     { ar: 'المبيعات',    en: 'Sales'      },
  cost:      { ar: 'حاسبة الكوست',en: 'Cost Calc'  },
  reports:   { ar: 'التقارير',    en: 'Reports'    },
  users:     { ar: 'إدارة الحسابات', en: 'User Mgmt' },
}
const ROLES = ['admin','manager','staff','readonly'] as const
const ROLE_LABELS: Record<string, {ar:string,en:string}> = {
  admin:    {ar:'مدير عام',   en:'Admin'},
  manager:  {ar:'مدير',      en:'Manager'},
  staff:    {ar:'موظف',      en:'Staff'},
  readonly: {ar:'قراءة فقط', en:'Read Only'},
}

export default function RegisterPage() {
  const router = useRouter()
  const [lang, setLang] = useState<'ar'|'en'>('ar')
  const isAR = lang === 'ar'
  const [form, setForm] = useState({ name:'', username:'', password:'', confirm:'', adminPass:'' })
  const [role, setRole] = useState<'staff'|'manager'|'admin'|'readonly'>('staff')
  const [perms, setPerms] = useState({...ROLE_CONFIG.staff.defaultPerms})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setRoleAndPerms = (r: typeof role) => {
    setRole(r)
    setPerms({...ROLE_CONFIG[r].defaultPerms})
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.name || !form.username || !form.password) return setError(isAR ? 'أكمل جميع الحقول' : 'Fill all fields')
    if (form.password !== form.confirm) return setError(isAR ? 'كلمة المرور غير متطابقة' : 'Passwords do not match')
    if (form.password.length < 3) return setError(isAR ? 'كلمة المرور قصيرة جداً' : 'Password too short')
    setLoading(true)
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role, perms })
      })
      const data = await res.json()
      if (res.ok) router.push('/login')
      else setError(data.error || 'Error')
    } finally { setLoading(false) }
  }

  return (
    <div dir={isAR?'rtl':'ltr'} style={{ minHeight:'100vh', background:'#f5f5f3', padding:'20px', overflowY:'auto' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <button onClick={() => router.push('/login')} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', fontSize:13, display:'flex', alignItems:'center', gap:5, marginBottom:14, padding:0, fontFamily:'inherit' }}>
          ← {isAR ? 'رجوع' : 'Back'}
        </button>

        <div className="card" style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 3 }}>{isAR ? 'إنشاء حساب موظف' : 'Create Employee Account'}</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{isAR ? 'يُنشأ بواسطة المدير فقط' : 'Created by admin only'}</div>

          <div className="alert alert-info">ℹ {isAR ? 'باسورد المدير مطلوب للتأكيد' : 'Admin password required to confirm'}</div>

          {error && <div className="alert alert-error">⚠ {error}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            {[
              { id:'name', label:{ar:'الاسم الكامل',en:'Full Name'}, type:'text' },
              { id:'username', label:{ar:'اسم المستخدم',en:'Username'}, type:'text', dir:'ltr' },
              { id:'password', label:{ar:'كلمة المرور',en:'Password'}, type:'password', dir:'ltr' },
              { id:'confirm', label:{ar:'تأكيد كلمة المرور',en:'Confirm Password'}, type:'password', dir:'ltr' },
            ].map(f => (
              <div key={f.id}>
                <div style={{ fontSize:11, fontWeight:500, color:'#666', marginBottom:4 }}>{f.label[lang]}</div>
                <input type={f.type} value={(form as any)[f.id]} onChange={e => setForm({...form, [f.id]: e.target.value})} dir={f.dir} />
              </div>
            ))}
          </div>

          {/* Role */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'#666', marginBottom:7 }}>{isAR ? 'الدور الوظيفي' : 'Role'}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ROLES.map(r => {
                const rc = ROLE_CONFIG[r]
                const sel = r === role
                return (
                  <button key={r} onClick={() => setRoleAndPerms(r)} style={{ padding:'6px 14px', fontSize:12, borderRadius:20, border:'0.5px solid', cursor:'pointer', fontFamily:'inherit', fontWeight: sel?500:400, background: sel?rc.bg:'transparent', color: sel?rc.color:'#888', borderColor: sel?rc.color:'#d4d4d4' }}>
                    {ROLE_LABELS[r][lang]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Permissions */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'#666', marginBottom:8 }}>{isAR ? 'الصلاحيات' : 'Permissions'}</div>
            {Object.entries(PERM_LABELS).map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'0.5px solid #e5e5e5', fontSize:13 }}>
                <span>{v[lang]}</span>
                <button className={`switch ${perms[k as keyof typeof perms] ? 'on' : ''}`} onClick={() => setPerms({...perms, [k]: !perms[k as keyof typeof perms]})} />
              </div>
            ))}
          </div>

          {/* Admin pass */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'#666', marginBottom:5 }}>{isAR ? 'باسورد المدير للتأكيد' : 'Admin Password to Confirm'}</div>
            <input type="password" value={form.adminPass} onChange={e => setForm({...form, adminPass:e.target.value})} dir="ltr" />
          </div>

          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 0' }} onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : (isAR ? 'إنشاء الحساب' : 'Create Account')}
          </button>
        </div>

        <div style={{ textAlign:'center', marginTop:12, display:'flex', justifyContent:'center', gap:6 }}>
          {(['ar','en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding:'4px 12px', fontSize:12, borderRadius:6, border:'0.5px solid', cursor:'pointer', background:lang===l?'#1D9E75':'transparent', color:lang===l?'#fff':'#888', borderColor:lang===l?'#1D9E75':'#d4d4d4' }}>{l==='ar'?'ع':'EN'}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
