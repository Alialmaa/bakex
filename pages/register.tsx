import { useState } from 'react'
import { useRouter } from 'next/router'
import { useLang } from '../lib/useLang'

export default function RegisterPage() {
  const router = useRouter()
  const { lang, setLang } = useLang()
  const isAR = lang === 'ar'
  const [form, setForm] = useState({ name:'', username:'', password:'', confirm:'' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!form.name || !form.username || !form.password) return setError(isAR ? 'أكمل جميع الحقول' : 'Fill all fields')
    if (form.password !== form.confirm) return setError(isAR ? 'كلمة المرور غير متطابقة' : 'Passwords do not match')
    if (form.password.length < 3) return setError(isAR ? 'كلمة المرور قصيرة جداً' : 'Password too short')
    setLoading(true)
    try {
      const res = await fetch('/api/users/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok) setSuccess(true)
      else setError(data.error || 'Error')
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div dir={isAR?'rtl':'ltr'} style={{ minHeight:'100vh', background:'#f5f5f3', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ maxWidth: 420, width:'100%' }}>
          <div className="card" style={{ padding: '32px 28px', textAlign:'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{isAR ? 'تم إرسال طلبك' : 'Request Submitted'}</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
              {isAR ? 'سيتم مراجعة طلبك من قبل المدير. ستتمكن من الدخول بعد الموافقة.' : 'Your request will be reviewed by an admin. You can login once approved.'}
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 0' }} onClick={() => router.push('/login')}>
              {isAR ? 'الرجوع لتسجيل الدخول' : 'Back to Login'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir={isAR?'rtl':'ltr'} style={{ minHeight:'100vh', background:'#f5f5f3', padding:'20px', overflowY:'auto' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <button onClick={() => router.push('/login')} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', fontSize:13, display:'flex', alignItems:'center', gap:5, marginBottom:14, padding:0, fontFamily:'inherit' }}>
          ← {isAR ? 'رجوع' : 'Back'}
        </button>

        <div className="card" style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>{isAR ? 'طلب إنشاء حساب' : 'Request Account'}</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{isAR ? 'سيتم مراجعة طلبك من قبل المدير' : 'Your request will be reviewed by admin'}</div>

          <div className="alert alert-info">ℹ {isAR ? 'الموافقة على الطلب تتم من داخل النظام بواسطة المدير' : 'Account approval happens inside the system by admin'}</div>

          {error && <div className="alert alert-error">⚠ {error}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
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

          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'11px 0' }} onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : (isAR ? 'إرسال طلب الحساب' : 'Submit Request')}
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
