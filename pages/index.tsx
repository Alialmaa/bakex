import { useRouter } from 'next/router'
import { useState } from 'react'
import { fmtDateLong } from '../lib/datetime'

const G = '#16a679'
const GD = '#0d7a5a'
const DARK = '#0b0f1a'

export default function Landing() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font-ui)', color: DARK, background: '#fff', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        background: 'rgba(11,15,26,0.92)',
        backdropFilter: 'blur(16px)',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6vw',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.6px' }}>Bake<span style={{ color: G }}>x</span></span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[
            { label: 'المميزات', id: 'features' },
            { label: 'كيف يعمل', id: 'how' },
            { label: 'الأسعار', id: 'pricing' },
            { label: 'الأسئلة الشائعة', id: 'faq' },
          ].map(l => (
            <button key={l.label}
              onClick={() => document.getElementById(l.id)?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', color: 'rgba(255,255,255,0.6)', padding: '7px 12px', borderRadius: 8, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
              {l.label}
            </button>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/login')}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '8px 18px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(255,255,255,0.8)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}>
            الدخول
          </button>
          <button onClick={() => router.push('/register')}
            style={{ background: G, border: 'none', borderRadius: 9, padding: '8px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = GD}
            onMouseLeave={e => e.currentTarget.style.background = G}>
            ابدأ مجاناً
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,166,121,0.18) 0%, transparent 60%), linear-gradient(180deg, ${DARK} 0%, #0d1629 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        padding: '120px 6vw 80px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,166,121,0.12)', border: '1px solid rgba(22,166,121,0.3)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 32, position: 'relative' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}` }} />
          نظام إدارة المخابز الأول في السعودية
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-2.5px', color: '#fff', marginBottom: 24, maxWidth: 800, position: 'relative' }}>
          إدارة مخبزك<br />
          <span style={{ background: `linear-gradient(135deg, ${G}, #34d399)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>باحترافية كاملة</span>
        </h1>

        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: 44, maxWidth: 520, position: 'relative' }}>
          من المخزون إلى الكاشير إلى التقارير — كل شيء في مكان واحد. صُمّم خصيصاً للمخابز السعودية.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64, position: 'relative' }}>
          <button onClick={() => router.push('/register')}
            style={{ background: G, border: 'none', borderRadius: 12, padding: '15px 36px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: `0 8px 32px rgba(22,166,121,0.45)`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = GD; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px rgba(22,166,121,0.55)` }}
            onMouseLeave={e => { e.currentTarget.style.background = G; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(22,166,121,0.45)` }}>
            اطلب عرضاً مجانياً ←
          </button>
          <button onClick={() => router.push('/login')}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '15px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(255,255,255,0.8)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}>
            الدخول للنظام
          </button>
        </div>

        {/* Dashboard preview */}
        <div style={{ width: '100%', maxWidth: 900, position: 'relative' }}>
          {/* Glow */}
          <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: `radial-gradient(ellipse, rgba(22,166,121,0.15) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '20px 24px', position: 'relative', zIndex: 1, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            {/* Mock topbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>لوحة التحكم — اليوم</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} suppressHydrationWarning>{fmtDateLong(new Date(), 'ar')}</div>
            </div>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { l: 'المبيعات اليوم', v: '٤,٢٠٠', u: 'ر.س', c: G, ic: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
                { l: 'الفواتير', v: '٣٨', u: 'فاتورة', c: '#818cf8', ic: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                { l: 'المخزون', v: '٩٤', u: '٪', c: '#f59e0b', ic: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
                { l: 'الإنتاج', v: '٣٢٠', u: 'وحدة', c: '#34d399', ic: 'M18 20V10M12 20V4M6 20v-6' },
              ].map(m => (
                <div key={m.l} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{m.l}</div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: m.c + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.ic}/></svg>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{m.v} <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>{m.u}</span></div>
                </div>
              ))}
            </div>
            {/* Bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, padding: '0 4px' }}>
              {[30, 52, 38, 70, 45, 88, 60, 72, 40, 65, 55, 80].map((h, i) => (
                <div key={i} style={{ flex: 1, background: i === 5 || i === 11 ? G : 'rgba(22,166,121,0.18)', borderRadius: '4px 4px 0 0', height: `${h}%`, transition: 'height 0.3s' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Trust */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 48, position: 'relative', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex' }}>
            {['أ','م','ف','س','ع'].map((c, i) => (
              <div key={i} style={{ width: 34, height: 34, borderRadius: '50%', background: [G,'#6366f1','#f59e0b','#ef4444','#06b6d4'][i], border: '2px solid rgba(255,255,255,0.15)', marginLeft: i > 0 ? -10 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{c}</div>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>+٥٠٠ مخبز يثق بنا</div>
            <div style={{ display: 'flex', gap: 1, marginTop: 3 }}>
              {[...Array(5)].map((_,i) => <span key={i} style={{ color: '#fbbf24', fontSize: 13 }}>★</span>)}
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginRight: 6, lineHeight: '18px' }}>٤.٩/٥</span>
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>متاح في: الرياض · جدة · الدمام · أبوظبي · القاهرة</div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>المميزات</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,48px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14, color: DARK }}>كل ما تحتاجه في مكان واحد</h2>
            <p style={{ fontSize: 17, color: '#64748b', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>صُمم خصيصاً لاحتياجات المخابز السعودية</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 18 }}>
            {[
              { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', title: 'كاشير احترافي', desc: 'واجهة سريعة لنقطة البيع مع فواتير رقمية فورية وحساب الباقي تلقائياً', color: '#6366f1', bg: '#f0f0ff' },
              { icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', title: 'مخزون ذكي', desc: 'تتبع المواد الخام مع خصم تلقائي عند كل بيع وتنبيهات نفاد المخزون', color: G, bg: '#ecfdf5' },
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'حساب التكاليف', desc: 'احسب تكلفة كل منتج تلقائياً وحدد هامش الربح المثالي لكل وصفة', color: '#f59e0b', bg: '#fffbeb' },
              { icon: 'M18 20V10M12 20V4M6 20v-6', title: 'تقارير تفصيلية', desc: 'تقارير يومية وأسبوعية وشهرية للمبيعات والإيرادات والأرباح', color: '#ef4444', bg: '#fef2f2' },
              { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', title: 'إدارة الفريق', desc: 'أضف موظفين بصلاحيات محددة — كاشير، مشرف، مدير بدون تعقيد', color: '#06b6d4', bg: '#ecfeff' },
              { icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', title: 'متعدد الفروع', desc: 'أدر أكثر من مخبز من حساب واحد مع تقارير منفصلة لكل فرع', color: '#8b5cf6', bg: '#f5f3ff' },
            ].map((f, i) => (
              <div key={i}
                style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 18, padding: '28px 28px', cursor: 'default', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'all 0.22s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '50'; e.currentTarget.style.boxShadow = `0 16px 40px ${f.color}18`; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ width: 48, height: 48, background: f.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon}/></svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: DARK }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '100px 6vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>كيف يعمل</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14, color: DARK }}>ابدأ في ٣ خطوات فقط</h2>
            <p style={{ fontSize: 16, color: '#64748b' }}>لا تحتاج خبرة تقنية — ابدأ في دقائق</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {[
              { n: '١', title: 'أنشئ مخبزك', desc: 'سجّل بياناتك الأساسية وأضف موظفيك في أقل من ٥ دقائق بدون أي تدريب', color: G },
              { n: '٢', title: 'أضف منتجاتك', desc: 'ادخل وصفاتك ومكوناتها وسعر البيع — النظام يحسب التكلفة تلقائياً', color: '#6366f1' },
              { n: '٣', title: 'ابدأ البيع فوراً', desc: 'افتح الكاشير من أي جهاز وأصدر فواتيرك بلمسة واحدة باحترافية كاملة', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1.5px solid #e9ecf1', borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', position: 'relative' }}>
                <div style={{ width: 54, height: 54, background: s.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 22, fontWeight: 900, color: '#fff', boxShadow: `0 8px 24px ${s.color}55` }}>{s.n}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: DARK }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.85 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: DARK, padding: '80px 6vw', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 50% 50%, rgba(22,166,121,0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center', position: 'relative' }}>
          {[
            { n: '+٥٠٠', label: 'مخبز نشط' },
            { n: '+٢٠ألف', label: 'فاتورة يومياً' },
            { n: '٩٩.٩٪', label: 'وقت التشغيل' },
            { n: '٣ دقائق', label: 'للبدء' },
          ].map(s => (
            <div key={s.n} style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 'clamp(30px,3vw,48px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px' }}>{s.n}</div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '100px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>آراء العملاء</div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, letterSpacing: '-1px', color: DARK }}>ماذا يقول أصحاب المخابز</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18 }}>
            {[
              { name: 'أحمد الغامدي', role: 'مخبز الوفاء — الرياض', text: 'وفّر علينا ساعات يومياً في حساب المخزون. الكاشير سهّل على موظفينا جداً.' },
              { name: 'محمد القحطاني', role: 'مخبز النور — جدة', text: 'المزامنة التلقائية بين الكاشير والمخزون رائعة — لما نبيع الكيك ينزل فوراً من المخزون.' },
              { name: 'فهد العتيبي', role: 'مخبز الأصيل — الدمام', text: 'التقارير خلّتنا نعرف أي منتج أكثر مبيعاً. زادت أرباحنا ٣٠٪ خلال شهر.' },
            ].map((t, i) => (
              <div key={i} style={{ background: '#f9fafb', border: '1.5px solid #f1f5f9', borderRadius: 20, padding: 28, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
                  {[...Array(5)].map((_,j) => <span key={j} style={{ color: '#fbbf24', fontSize: 16 }}>★</span>)}
                </div>
                <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.85, marginBottom: 22, fontStyle: 'italic' }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '100px 6vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>الأسعار</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, color: DARK }}>سعر واحد بدون مفاجآت</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 56 }}>ابدأ مجاناً — لا بطاقة ائتمان مطلوبة</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              { plan: 'مجاني', price: '٠', period: 'دائماً', highlight: false, features: ['مخبز واحد','كاشير واحد','حتى ١٠ منتجات','التقارير الأساسية'], cta: 'ابدأ مجاناً' },
              { plan: 'احترافي', price: '١٤٩', period: 'ر.س / شهر', highlight: true, features: ['مخابز غير محدودة','كاشيرات متعددة','منتجات غير محدودة','تقارير متقدمة','دعم فني ٢٤/٧'], cta: 'ابدأ تجربة مجانية' },
              { plan: 'المؤسسات', price: 'تواصل', period: 'معنا', highlight: false, features: ['كل مميزات الاحترافي','تكامل مع الأنظمة','تدريب وإعداد','مدير حساب مخصص'], cta: 'تواصل معنا' },
            ].map((p, i) => (
              <div key={i} style={{ background: p.highlight ? DARK : '#fff', border: p.highlight ? `2px solid ${G}` : '1.5px solid #e2e8f0', borderRadius: 22, padding: '36px 28px', position: 'relative', boxShadow: p.highlight ? '0 28px 64px rgba(15,23,42,0.3)' : '0 4px 16px rgba(0,0,0,0.04)', transform: p.highlight ? 'scale(1.05)' : 'none', transition: 'transform 0.2s' }}>
                {p.highlight && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: G, color: '#fff', borderRadius: 99, padding: '4px 20px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>الأكثر اختياراً</div>}
                <div style={{ fontSize: 14, fontWeight: 600, color: p.highlight ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 10 }}>{p.plan}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: p.highlight ? '#fff' : DARK, letterSpacing: '-2px', lineHeight: 1 }}>{p.price}</div>
                <div style={{ fontSize: 13, color: p.highlight ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginBottom: 28, marginTop: 6 }}>{p.period}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: p.highlight ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push('/register')}
                  style={{ width: '100%', background: p.highlight ? G : 'transparent', border: `2px solid ${p.highlight ? G : '#e2e8f0'}`, borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: p.highlight ? '#fff' : '#374151', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (p.highlight) e.currentTarget.style.background = GD; else { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af' } }}
                  onMouseLeave={e => { if (p.highlight) e.currentTarget.style.background = G; else { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0' } }}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '90px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>الأسئلة الشائعة</div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 900, letterSpacing: '-1px', color: DARK }}>أسئلة تخطر في بالك</h2>
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
                style={{ width: '100%', background: 'none', border: 'none', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: DARK, textAlign: 'right', gap: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
                {faq.q}
              </button>
              {openFaq === i && <div style={{ paddingBottom: 22, fontSize: 15, color: '#64748b', lineHeight: 1.85 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '100px 6vw', background: DARK, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 80% at 50% 50%, rgba(22,166,121,0.15) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 20 }}>ابدأ الآن</div>
          <h2 style={{ fontSize: 'clamp(30px,4vw,54px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', marginBottom: 18, lineHeight: 1.1 }}>جاهز تطوّر مخبزك؟</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 44, lineHeight: 1.75 }}>انضم لمئات المخابز التي تدير عملها باحترافية مع Bakex</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')}
              style={{ background: G, border: 'none', borderRadius: 12, padding: '15px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: `0 8px 32px rgba(22,166,121,0.45)`, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = GD; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = G; e.currentTarget.style.transform = 'translateY(0)' }}>
              ابدأ مجاناً الآن
            </button>
            <button onClick={() => router.push('/login')}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '15px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(255,255,255,0.75)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}>
              تسجيل الدخول
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#070b14', padding: '56px 6vw 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, paddingBottom: 44, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 28 }}>
            <div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.6px' }}>Bake<span style={{ color: G }}>x</span></span>
              </div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.85, maxWidth: 240 }}>حلول متكاملة لإدارة المخابز السعودية من المخزون حتى الكاشير.</p>
            </div>
            {[
              { title: 'المنتج', links: ['المميزات','الأسعار','كيف يعمل','الكاشير'] },
              { title: 'الشركة', links: ['حول Bakex','تواصل معنا','الشروط','الخصوصية'] },
              { title: 'الدعم', links: ['مركز المساعدة','دليل البدء','الفيديوهات','تواصل مباشر'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>{col.title}</div>
                {col.links.map(l => <div key={l} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', marginBottom: 12, cursor: 'pointer', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>{l}</div>)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>© 2025 Bakex — جميع الحقوق محفوظة</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>مصنوع بـ ❤️ في السعودية 🇸🇦</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
