import { useRouter } from 'next/router'
import { useState } from 'react'

const G = '#16a679'
const GD = '#0d7a5a'
const DARK = '#0f172a'

export default function Landing() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div dir="rtl" style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: DARK, background: '#fff', overflowX: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: DARK, color: 'rgba(255,255,255,0.7)', fontSize: 12.5, padding: '8px 5vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'السعودية', phone: '920033227' },
            { label: 'الإمارات', phone: '8001000119' },
            { label: 'مصر', phone: '15796' },
          ].map(c => (
            <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
              {c.label}: {c.phone}
            </span>
          ))}
        </div>
        <span style={{ color: G, fontWeight: 600, cursor: 'pointer' }}>احصل على عرض مجاني ←</span>
      </div>

      {/* ── NAV ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5vw', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div style={{ width: 36, height: 36, background: G, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/>
            </svg>
          </div>
          <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px' }}>Bake<span style={{ color: G }}>x</span></span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { label: 'حول Bakex', id: '' },
            { label: 'المميزات', id: 'features' },
            { label: 'الأسعار', id: 'pricing' },
            { label: 'كيف يعمل', id: 'how' },
            { label: 'الأسئلة الشائعة', id: 'faq' },
          ].map(l => (
            <button key={l.label}
              onClick={() => l.id && document.getElementById(l.id)?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', color: '#374151', padding: '6px 10px', borderRadius: 7, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = DARK }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151' }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/login')}
            style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '9px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#374151', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff' }}>
            الدخول
          </button>
          <button onClick={() => router.push('/register')}
            style={{ background: G, border: 'none', borderRadius: 9, padding: '9px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: '0 2px 10px rgba(22,166,121,0.35)', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = GD}
            onMouseLeave={e => e.currentTarget.style.background = G}>
            ابدأ مجاناً
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '88vh', alignItems: 'center', padding: '60px 5vw', gap: 60, maxWidth: 1200, margin: '0 auto' }}>

        {/* Left: Visual grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, height: 480, order: 2 }}>
          {/* Dashboard card */}
          <div style={{ gridColumn: '1 / 3', background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderRadius: 18, padding: 20, overflow: 'hidden', position: 'relative', boxShadow: '0 20px 48px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>لوحة التحكم — اليوم</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[{ l: 'المبيعات', v: '٤,٢٠٠ ر.س', c: G }, { l: 'الفواتير', v: '٣٨', c: '#818cf8' }, { l: 'المخزون', v: '٩٤٪', c: '#f59e0b' }].map(m => (
                <div key={m.l} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 10px' }}>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>{m.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 60 }}>
              {[35, 58, 42, 75, 50, 88, 65].map((h, i) => (
                <div key={i} style={{ flex: 1, background: i === 5 ? G : 'rgba(22,166,121,0.2)', borderRadius: '3px 3px 0 0', height: `${h}%`, transition: 'height 0.3s' }} />
              ))}
            </div>
          </div>

          {/* Cashier card */}
          <div style={{ background: '#f0fdf4', borderRadius: 18, padding: 18, border: '1.5px solid #bbf7d0', boxShadow: '0 8px 24px rgba(22,166,121,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: G, marginBottom: 12 }}>آخر فاتورة</div>
            {['خبز عربي × ١٠', 'كيك × ٢'].map((i, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '5px 0', borderBottom: j === 0 ? '1px solid #dcfce7' : 'none' }}>
                <span style={{ color: '#374151' }}>{i}</span>
                <span style={{ fontWeight: 600, color: G }}>{j === 0 ? '٥٠' : '٣٠'} ر.س</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '2px solid #16a679', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>الإجمالي</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: G }}>٨٠ ر.س</span>
            </div>
          </div>

          {/* Stock alert */}
          <div style={{ background: '#fffbeb', borderRadius: 18, padding: 18, border: '1.5px solid #fde68a', boxShadow: '0 8px 24px rgba(245,158,11,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 12 }}>تنبيهات المخزون</div>
            {['دقيق القمح', 'سكر ناعم', 'زبدة'].map((item, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0' }}>
                <span style={{ color: '#374151' }}>{item}</span>
                <span style={{ background: j === 0 ? '#fef2f2' : '#fff7ed', color: j === 0 ? '#ef4444' : '#f59e0b', borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>{j === 0 ? 'نفد' : 'قليل'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Text */}
        <div style={{ order: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 99, padding: '5px 14px', fontSize: 12.5, color: GD, fontWeight: 600, marginBottom: 24 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: G }} />
            نظام إدارة المخابز الأول في السعودية
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 4.5vw, 58px)', fontWeight: 900, lineHeight: 1.12, letterSpacing: '-2px', color: DARK, marginBottom: 20 }}>
            حلول متكاملة<br />
            <span style={{ color: G }}>لجميع أنواع</span><br />
            المخابز
          </h1>

          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.8, marginBottom: 36, maxWidth: 460 }}>
            سواء كان لديك مخبز صغير أو سلسلة كاملة، ستجد لدى Bakex حلاً شاملاً لإدارة مخبزك — معدّلاً بحسب احتياجاتك.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 48, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')}
              style={{ background: G, border: 'none', borderRadius: 12, padding: '14px 34px', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: '0 6px 24px rgba(22,166,121,0.4)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = GD; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = G; e.currentTarget.style.transform = 'translateY(0)' }}>
              اطلب عرضاً للنظام
            </button>
            <button onClick={() => router.push('/login')}
              style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 28px', fontSize: 15.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#f9fafb' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff' }}>
              الدخول للنظام
            </button>
          </div>

          {/* Trust */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 24, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex' }}>
              {['#16a679','#6366f1','#f59e0b','#ef4444'].map((c, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: '2px solid #fff', marginLeft: i > 0 ? -10 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {['أ','م','ف','س'][i]}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>+٥٠٠ مخبز يثق بنا</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                {[...Array(5)].map((_,i) => <span key={i} style={{ color: '#fbbf24', fontSize: 12 }}>★</span>)}
                <span style={{ fontSize: 11.5, color: '#94a3b8', marginRight: 4 }}>٤.٩/٥</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS ── */}
      <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: '#fafafa', padding: '22px 5vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginLeft: 16 }}>يثق بنا في</span>
          {['الرياض','جدة','الدمام','مكة المكرمة','المدينة','أبوظبي','القاهرة'].map(c => (
            <div key={c} style={{ fontSize: 13, fontWeight: 600, color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 14px' }}>{c}</div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '90px 5vw' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>المميزات</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>كل ما تحتاجه في مكان واحد</h2>
            <p style={{ fontSize: 16.5, color: '#64748b', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>صُمم خصيصاً لاحتياجات المخابز السعودية</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            {[
              { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', title: 'كاشير احترافي', desc: 'واجهة سريعة لنقطة البيع مع فواتير رقمية فورية وحساب الباقي تلقائياً', color: '#6366f1', bg: '#eef2ff' },
              { icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', title: 'مخزون ذكي', desc: 'تتبع المواد الخام مع خصم تلقائي عند كل عملية بيع وتنبيهات النفاد', color: G, bg: '#ecfdf5' },
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'حساب التكاليف', desc: 'احسب تكلفة كل منتج تلقائياً وحدد هامش الربح المثالي لكل وصفة', color: '#f59e0b', bg: '#fffbeb' },
              { icon: 'M18 20V10M12 20V4M6 20v-6', title: 'تقارير تفصيلية', desc: 'تقارير يومية وأسبوعية وشهرية للمبيعات والإيرادات والأرباح', color: '#ef4444', bg: '#fef2f2' },
              { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', title: 'إدارة الفريق', desc: 'أضف موظفين بصلاحيات محددة — كاشير، مشرف، مدير', color: '#06b6d4', bg: '#ecfeff' },
              { icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', title: 'متعدد الفروع', desc: 'أدر أكثر من مخبز من حساب واحد مع تقارير منفصلة لكل فرع', color: '#8b5cf6', bg: '#f5f3ff' },
            ].map((f, i) => (
              <div key={i} style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 18, padding: 28, transition: 'all 0.2s', cursor: 'default', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '40'; e.currentTarget.style.boxShadow = `0 12px 32px ${f.color}15`; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ width: 50, height: 50, background: f.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon}/></svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '90px 5vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>كيف يعمل</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>ابدأ في ٣ خطوات فقط</h2>
            <p style={{ fontSize: 16, color: '#64748b' }}>لا تحتاج خبرة تقنية — ابدأ في دقائق</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative' }}>
            {[
              { n: '١', title: 'أنشئ مخبزك', desc: 'سجّل بياناتك الأساسية وأضف موظفيك في أقل من ٥ دقائق بدون أي تدريب', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: G },
              { n: '٢', title: 'أضف منتجاتك', desc: 'ادخل وصفاتك ومكوناتها وسعر البيع — النظام يحسب التكلفة تلقائياً', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: '#6366f1' },
              { n: '٣', title: 'ابدأ البيع فوراً', desc: 'افتح الكاشير من أي جهاز وأصدر فواتيرك بلمسة واحدة باحترافية كاملة', icon: 'M5 13l4 4L19 7', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', position: 'relative' }}>
                <div style={{ width: 52, height: 52, background: s.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22, fontWeight: 900, color: '#fff', boxShadow: `0 6px 20px ${s.color}50` }}>{s.n}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: DARK, padding: '72px 5vw' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center' }}>
          {[
            { n: '+٥٠٠', label: 'مخبز نشط' },
            { n: '+٢٠ألف', label: 'فاتورة يومياً' },
            { n: '٩٩.٩٪', label: 'وقت التشغيل' },
            { n: '٣ دقائق', label: 'للبدء' },
          ].map(s => (
            <div key={s.n}>
              <div style={{ fontSize: 'clamp(28px,3vw,44px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{s.n}</div>
              <div style={{ fontSize: 13.5, color: '#475569', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '90px 5vw', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>آراء العملاء</div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px' }}>ماذا يقول أصحاب المخابز</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {[
              { name: 'أحمد الغامدي', role: 'مخبز الوفاء — الرياض', text: 'وفّر علينا ساعات يومياً في حساب المخزون. الكاشير سهّل على موظفينا جداً.' },
              { name: 'محمد القحطاني', role: 'مخبز النور — جدة', text: 'المزامنة التلقائية بين الكاشير والمخزون رائعة — لما نبيع الكيك ينزل فوراً.' },
              { name: 'فهد العتيبي', role: 'مخبز الأصيل — الدمام', text: 'التقارير خلّتنا نعرف أي منتج أكثر مبيعاً. زادت أرباحنا ٣٠٪ خلال شهر.' },
            ].map((t, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 18, padding: 28, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
                  {[...Array(5)].map((_,j) => <span key={j} style={{ color: '#fbbf24', fontSize: 15 }}>★</span>)}
                </div>
                <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.8, marginBottom: 20, fontStyle: 'italic' }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '90px 5vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>الأسعار</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>سعر واحد بدون مفاجآت</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 52 }}>ابدأ مجاناً — لا بطاقة ائتمان مطلوبة</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              { plan: 'مجاني', price: '٠', period: 'دائماً', highlight: false, features: ['مخبز واحد','كاشير واحد','حتى ١٠ منتجات','التقارير الأساسية'], cta: 'ابدأ مجاناً' },
              { plan: 'احترافي', price: '١٤٩', period: 'ر.س / شهر', highlight: true, features: ['مخابز غير محدودة','كاشيرات متعددة','منتجات غير محدودة','تقارير متقدمة','دعم فني ٢٤/٧'], cta: 'ابدأ تجربة مجانية' },
              { plan: 'المؤسسات', price: 'تواصل', period: 'معنا', highlight: false, features: ['كل مميزات الاحترافي','تكامل مع الأنظمة','تدريب وإعداد','مدير حساب مخصص'], cta: 'تواصل معنا' },
            ].map((p, i) => (
              <div key={i} style={{ background: p.highlight ? DARK : '#fff', border: p.highlight ? `2px solid ${G}` : '1.5px solid #e2e8f0', borderRadius: 20, padding: 32, position: 'relative', boxShadow: p.highlight ? '0 24px 56px rgba(15,23,42,0.25)' : '0 4px 16px rgba(0,0,0,0.04)', transform: p.highlight ? 'scale(1.04)' : 'none' }}>
                {p.highlight && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: G, color: '#fff', borderRadius: 99, padding: '4px 18px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>الأكثر اختياراً</div>}
                <div style={{ fontSize: 15, fontWeight: 700, color: p.highlight ? '#94a3b8' : '#374151', marginBottom: 10 }}>{p.plan}</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: p.highlight ? '#fff' : DARK, letterSpacing: '-1.5px' }}>{p.price}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 26 }}>{p.period}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: p.highlight ? '#e2e8f0' : '#374151' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push('/register')}
                  style={{ width: '100%', background: p.highlight ? G : 'transparent', border: `2px solid ${p.highlight ? G : '#e2e8f0'}`, borderRadius: 11, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: p.highlight ? '#fff' : '#374151', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (p.highlight) e.currentTarget.style.background = GD }}
                  onMouseLeave={e => { if (p.highlight) e.currentTarget.style.background = G }}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '80px 5vw', background: '#fff' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>الأسئلة الشائعة</div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', fontWeight: 900, letterSpacing: '-1px' }}>أسئلة تخطر في بالك</h2>
          </div>
          {[
            { q: 'هل أحتاج خبرة تقنية للبدء؟', a: 'لا — صُمم النظام ليكون بسيطاً. تقدر تبدأ بدون أي تدريب مسبق.' },
            { q: 'هل يعمل على الآيباد والجوال؟', a: 'نعم، يعمل على أي جهاز ومتصفح — جوال، تابلت، وكمبيوتر.' },
            { q: 'كيف يتزامن الكاشير مع المخزون؟', a: 'عند إصدار أي فاتورة، يُخصم المخزون تلقائياً بناءً على مكونات الوصفة فوراً.' },
            { q: 'هل بياناتي آمنة؟', a: 'نعم، بياناتك محمية ومشفرة في سيرفرات سحابية آمنة.' },
            { q: 'هل يمكنني إضافة أكثر من موظف؟', a: 'نعم، يمكنك إضافة عدد غير محدود من الموظفين وتحديد صلاحيات كل منهم.' },
          ].map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: DARK, textAlign: 'right' }}>
                {faq.q}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {openFaq === i && <div style={{ paddingBottom: 20, fontSize: 15, color: '#64748b', lineHeight: 1.8 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '100px 5vw', background: G, textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(30px,4vw,50px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', marginBottom: 16 }}>جاهز تطوّر مخبزك؟</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 1.7 }}>انضم لمئات المخابز التي تدير عملها باحترافية مع Bakex</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')}
              style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '15px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: G, boxShadow: '0 6px 24px rgba(0,0,0,0.15)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              ابدأ مجاناً الآن
            </button>
            <button onClick={() => router.push('/login')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 12, padding: '15px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
              تسجيل الدخول
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: DARK, padding: '56px 5vw 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, paddingBottom: 44, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, background: G, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>
                </div>
                <span style={{ fontWeight: 900, fontSize: 20, color: '#fff' }}>Bake<span style={{ color: G }}>x</span></span>
              </div>
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.8, maxWidth: 250 }}>حلول متكاملة لإدارة المخابز السعودية من المخزون حتى الكاشير</p>
            </div>
            {[
              { title: 'المنتج', links: ['المميزات','الأسعار','كيف يعمل','الكاشير'] },
              { title: 'الشركة', links: ['حول Bakex','تواصل معنا','الشروط','الخصوصية'] },
              { title: 'الدعم', links: ['مركز المساعدة','دليل البدء','الفيديوهات','تواصل مباشر'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{col.title}</div>
                {col.links.map(l => <div key={l} style={{ fontSize: 13.5, color: '#475569', marginBottom: 10, cursor: 'pointer', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'} onMouseLeave={e => e.currentTarget.style.color = '#475569'}>{l}</div>)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#334155' }}>© 2025 Bakex — جميع الحقوق محفوظة</div>
            <div style={{ fontSize: 13, color: '#334155' }}>مصنوع بـ ❤️ في السعودية 🇸🇦</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
