import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { fmtDateLong } from '../lib/datetime'
import { useTilt } from '../lib/useTilt'

const G = '#16a679'
const GD = '#0d7a5a'
const DARK = '#0b0f1a'

const WHATSAPP = 'https://wa.me/966559219189?text=أريد الاشتراك في Bakex'

/** Annual price, in SAR. One place, so the page can never contradict itself. */
const YEARLY_PRICE = 2500
const TRIAL_DAYS = 30

const sar = (n: number) => n.toLocaleString('en-US')

/**
 * Wraps a figure in a bidi isolate.
 *
 * Without it a negative amount renders as "0.67−" in this RTL page: the minus is
 * neutral, so it drifts to the wrong end of the number.
 */
const iso = (s: string) => `⁦${s}⁩`

const ICONS = {
  money: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  invoice: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  bars: 'M18 20V10M12 20V4M6 20v-6',
  alert: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  cart: 'M9 21a1 1 0 100-2 1 1 0 000 2zM20 21a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6',
  percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  down: 'M23 18l-9.5-9.5-5 5L1 6',
} as const

/** Reveals a section once it scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} style={{
      opacity: shown ? 1 : 0,
      transform: shown ? 'none' : 'translateY(22px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

/** The three screens the hero mock can show. */
const SCREENS = {
  dashboard: {
    label: 'لوحة التحكم',
    kpis: [
      { l: 'المبيعات اليوم', v: '4,200', u: 'ر.س', c: G, ic: ICONS.money },
      { l: 'الفواتير', v: '38', u: 'فاتورة', c: '#818cf8', ic: ICONS.invoice },
      { l: 'المخزون', v: '94', u: '%', c: '#f59e0b', ic: ICONS.box },
      { l: 'الإنتاج', v: '320', u: 'وحدة', c: '#34d399', ic: ICONS.bars },
    ],
    bars: [30, 52, 38, 70, 45, 88, 60, 72, 40, 65, 55, 80],
  },
  stock: {
    label: 'المخزون',
    kpis: [
      { l: 'أصناف', v: '46', u: 'صنف', c: '#6366f1', ic: ICONS.box },
      { l: 'تحت الحد', v: '3', u: 'أصناف', c: '#ef4444', ic: ICONS.alert },
      { l: 'قيمة المخزون', v: '18,940', u: 'ر.س', c: G, ic: ICONS.money },
      { l: 'مشتريات الشهر', v: '7,300', u: 'ر.س', c: '#f59e0b', ic: ICONS.cart },
    ],
    bars: [70, 65, 80, 40, 55, 30, 75, 60, 85, 50, 68, 45],
  },
  reports: {
    label: 'التقارير',
    kpis: [
      { l: 'الإيراد', v: '82,500', u: 'ر.س', c: G, ic: ICONS.bars },
      { l: 'التكلفة', v: '41,200', u: 'ر.س', c: '#ef4444', ic: ICONS.down },
      { l: 'صافي الربح', v: '41,300', u: 'ر.س', c: '#34d399', ic: ICONS.money },
      { l: 'الهامش', v: '50', u: '%', c: '#f59e0b', ic: ICONS.percent },
    ],
    bars: [45, 60, 52, 78, 66, 90, 72, 84, 58, 76, 68, 92],
  },
} as const

type ScreenKey = keyof typeof SCREENS

export default function Landing() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [screen, setScreen] = useState<ScreenKey>('dashboard')
  const tilt = useTilt(9)

  // Interactive margin calculator — the product's core sum, run by the visitor
  // on their own figures. It replaces a block of invented testimonials.
  const [batchCost, setBatchCost] = useState(38)
  const [units, setUnits] = useState(12)
  const [price, setPrice] = useState(6.5)
  const unitCost = units > 0 ? batchCost / units : 0
  const profit = price - unitCost
  const margin = price > 0 ? (profit / price) * 100 : 0

  const active = SCREENS[screen]

  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font-ui)', color: DARK, background: '#fff', overflowX: 'hidden' }}>

      <style jsx>{`
        .scene { perspective: 1200px; }
        .tilt {
          transform-style: preserve-3d;
          transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
          will-change: transform;
        }
        .depth-1 { transform: translateZ(28px); }
        .depth-2 { transform: translateZ(52px); }
        .lift {
          transform-style: preserve-3d;
          transition: transform 0.25s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.25s, border-color 0.25s;
        }
        .bar { animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @keyframes grow { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
        .range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 99px; outline: none;
          background: #e2e8f0; cursor: pointer;
        }
        .range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: ${G}; border: 3px solid #fff;
          box-shadow: 0 2px 10px rgba(22,166,121,0.5); cursor: grab;
        }
        .range::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: ${G}; border: 3px solid #fff; cursor: grab;
        }
        @media (prefers-reduced-motion: reduce) {
          .tilt, .lift { transition: none; }
          .bar { animation: none; }
        }
      `}</style>

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
        <div style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.6px' }}>Bake<span style={{ color: G }}>x</span></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[
            { label: 'المميزات', id: 'features' },
            { label: 'الحاسبة', id: 'calculator' },
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
            ابدأ التجربة
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
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,166,121,0.12)', border: '1px solid rgba(22,166,121,0.3)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 32, position: 'relative' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}` }} />
          نظام إدارة المخابز — صُنع في السعودية
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-2.5px', color: '#fff', marginBottom: 24, maxWidth: 800, position: 'relative' }}>
          إدارة مخبزك<br />
          <span style={{ background: `linear-gradient(135deg, ${G}, #34d399)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>باحترافية كاملة</span>
        </h1>

        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: 44, maxWidth: 520, position: 'relative' }}>
          من المخزون إلى الكاشير إلى التقارير — كل شيء في مكان واحد. صُمّم خصيصاً للمخابز السعودية.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56, position: 'relative' }}>
          <button onClick={() => router.push('/register')}
            style={{ background: G, border: 'none', borderRadius: 12, padding: '15px 36px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: `0 8px 32px rgba(22,166,121,0.45)`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = GD; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px rgba(22,166,121,0.55)` }}
            onMouseLeave={e => { e.currentTarget.style.background = G; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(22,166,121,0.45)` }}>
            ابدأ شهرك التجريبي ←
          </button>
          <button onClick={() => router.push('/login')}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '15px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(255,255,255,0.8)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}>
            الدخول للنظام
          </button>
        </div>

        {/* Screen switcher — the mock below follows it */}
        <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, marginBottom: 24, position: 'relative' }}>
          {(Object.keys(SCREENS) as ScreenKey[]).map(k => (
            <button key={k} onClick={() => setScreen(k)}
              style={{
                background: screen === k ? G : 'transparent',
                color: screen === k ? '#fff' : 'rgba(255,255,255,0.55)',
                border: 'none', borderRadius: 9, padding: '8px 18px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.18s',
              }}>
              {SCREENS[k].label}
            </button>
          ))}
        </div>

        {/* Dashboard preview — tilts toward the pointer in 3D */}
        <div className="scene" style={{ width: '100%', maxWidth: 900, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: `radial-gradient(ellipse, rgba(22,166,121,0.15) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

          <div
            ref={tilt.ref}
            className="tilt"
            onMouseMove={tilt.onMove}
            onMouseLeave={tilt.onLeave}
            // No backdrop-filter here: a filter forces `transform-style` back to
            // flat, which would collapse the depth of the layers inside. Over a
            // smooth gradient the blur was invisible anyway.
            style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '20px 24px', position: 'relative', zIndex: 1, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{active.label} — اليوم</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} suppressHydrationWarning>{fmtDateLong(new Date(), 'ar')}</div>
            </div>

            <div className={tilt.enabled ? 'depth-1' : undefined} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {active.kpis.map(m => (
                <div key={m.l} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{m.l}</div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: m.c + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.ic}/></svg>
                    </div>
                  </div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                    {m.v} <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>{m.u}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={tilt.enabled ? 'depth-2' : undefined} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, padding: '0 4px' }}>
              {active.bars.map((h, i) => (
                <div key={`${screen}-${i}`} className="bar"
                  style={{
                    flex: 1,
                    background: h >= 85 ? G : 'rgba(22,166,121,0.18)',
                    borderRadius: '4px 4px 0 0',
                    height: `${h}%`,
                    transformOrigin: 'bottom',
                    animationDelay: `${i * 35}ms`,
                  }} />
              ))}
            </div>
          </div>
        </div>

        {/* What you actually get — no invented counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 44, position: 'relative', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            `${TRIAL_DAYS} يوماً تجريبية مجانية`,
            'تابلت مع الاشتراك السنوي',
            'يعمل على الجوال والتابلت والكمبيوتر',
            'واجهة عربية كاملة',
          ].map(t => (
            <div key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '7px 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              {t}
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>المميزات</div>
              <h2 style={{ fontSize: 'clamp(30px,4vw,48px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14, color: DARK }}>كل ما تحتاجه في مكان واحد</h2>
              <p style={{ fontSize: 17, color: '#64748b', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>صُمم خصيصاً لاحتياجات المخابز السعودية</p>
            </div>
          </Reveal>

          <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 18 }}>
            {[
              { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', title: 'كاشير احترافي', desc: 'واجهة سريعة لنقطة البيع مع فواتير رقمية فورية وحساب الباقي تلقائياً', color: '#6366f1', bg: '#f0f0ff' },
              { icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', title: 'مخزون ذكي', desc: 'تتبع المواد الخام مع خصم تلقائي عند كل بيع وتنبيهات نفاد المخزون', color: G, bg: '#ecfdf5' },
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'حساب التكاليف', desc: 'احسب تكلفة كل منتج تلقائياً وحدد هامش الربح المثالي لكل وصفة', color: '#f59e0b', bg: '#fffbeb' },
              { icon: 'M18 20V10M12 20V4M6 20v-6', title: 'تقارير تفصيلية', desc: 'تقارير يومية وأسبوعية وشهرية للمبيعات والإيرادات والأرباح', color: '#ef4444', bg: '#fef2f2' },
              { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', title: 'إدارة الفريق', desc: 'أضف موظفين بصلاحيات محددة — كاشير، مشرف، مدير بدون تعقيد', color: '#06b6d4', bg: '#ecfeff' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 70}>
                <div
                  className="lift"
                  style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 18, padding: 28, cursor: 'default', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: '100%' }}
                  onMouseMove={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    const px = (e.clientX - r.left) / r.width - 0.5
                    const py = (e.clientY - r.top) / r.height - 0.5
                    e.currentTarget.style.transform = `translateZ(30px) rotateX(${-py * 7}deg) rotateY(${px * 7}deg)`
                    e.currentTarget.style.borderColor = f.color + '50'
                    e.currentTarget.style.boxShadow = `0 22px 50px ${f.color}22`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.borderColor = '#f1f5f9'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
                  }}>
                  <div style={{ width: 48, height: 48, background: f.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon}/></svg>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: DARK }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE CALCULATOR ── */}
      <section id="calculator" style={{ padding: '100px 6vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>جرّبها الآن</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14, color: DARK }}>هل تعرف ربح كل قطعة تبيعها؟</h2>
              <p style={{ fontSize: 16.5, color: '#64748b', maxWidth: 540, margin: '0 auto', lineHeight: 1.8 }}>
                حرّك الأرقام بأرقام مخبزك — هذه نفس المعادلة التي يشتغل بها النظام على كل وصفة عندك.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'stretch' }}>

              {/* Inputs */}
              <div style={{ background: '#fff', border: '1.5px solid #e9ecf1', borderRadius: 22, padding: '30px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                {[
                  { label: 'تكلفة مكوّنات الصينية', value: batchCost, set: setBatchCost, min: 5, max: 300, step: 1, unit: 'ر.س' },
                  { label: 'عدد القطع في الصينية', value: units, set: setUnits, min: 1, max: 60, step: 1, unit: 'قطعة' },
                  { label: 'سعر بيع القطعة', value: price, set: setPrice, min: 0.5, max: 60, step: 0.5, unit: 'ر.س' },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 26 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{f.label}</label>
                      <span className="num" style={{ fontSize: 17, fontWeight: 800, color: DARK }}>
                        {f.value} <span style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8' }}>{f.unit}</span>
                      </span>
                    </div>
                    <input type="range" className="range"
                      min={f.min} max={f.max} step={f.step} value={f.value}
                      onChange={e => f.set(Number(e.target.value))}
                      aria-label={f.label}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.7 }}>
                  في النظام تُقرأ هذه الأرقام من وصفاتك ومن أسعار مشترياتك تلقائياً — بدون إدخال يدوي.
                </div>
              </div>

              {/* Result */}
              <div style={{ background: DARK, borderRadius: 22, padding: '30px 28px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 28px 64px rgba(15,23,42,0.28)' }}>
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 80% 0%, rgba(22,166,121,0.22) 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', marginBottom: 22 }}>النتيجة</div>

                  {[
                    { l: 'تكلفة القطعة', v: iso(unitCost.toFixed(2)), u: 'ر.س', c: '#fbbf24' },
                    { l: 'ربح القطعة', v: iso(profit.toFixed(2)), u: 'ر.س', c: profit >= 0 ? '#34d399' : '#f87171' },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{r.l}</span>
                      <span className="num" style={{ fontSize: 26, fontWeight: 800, color: r.c, letterSpacing: '-0.8px' }}>
                        {r.v} <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>{r.u}</span>
                      </span>
                    </div>
                  ))}

                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>هامش الربح</span>
                      <span className="num" style={{ fontSize: 34, fontWeight: 900, color: margin < 0 ? '#f87171' : margin < 15 ? '#fbbf24' : '#34d399', letterSpacing: '-1.5px' }}>
                        {iso(margin.toFixed(1))}<span style={{ fontSize: 16 }}>%</span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, margin))}%`,
                        background: margin < 15 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : `linear-gradient(90deg,${G},#34d399)`,
                        borderRadius: 99,
                        transition: 'width 0.25s ease, background 0.25s',
                      }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 14, lineHeight: 1.7 }}>
                      {margin < 0
                        ? 'السعر أقل من التكلفة — كل قطعة تُباع بخسارة.'
                        : margin < 15
                          ? 'الهامش منخفض. النظام ينبّهك على المنتجات في هذا النطاق.'
                          : 'هامش صحّي. النظام يرتّب منتجاتك من الأعلى ربحاً للأدنى.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '100px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>كيف يعمل</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14, color: DARK }}>ابدأ في 3 خطوات فقط</h2>
              <p style={{ fontSize: 16, color: '#64748b' }}>لا تحتاج خبرة تقنية — ابدأ في دقائق</p>
            </div>
          </Reveal>
          <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {[
              { n: '1', title: 'أنشئ مخبزك', desc: 'سجّل بياناتك الأساسية وأضف موظفيك في دقائق بدون أي تدريب', color: G },
              { n: '2', title: 'أضف منتجاتك', desc: 'ادخل وصفاتك ومكوناتها وسعر البيع — النظام يحسب التكلفة تلقائياً', color: '#6366f1' },
              { n: '3', title: 'ابدأ البيع فوراً', desc: 'افتح الكاشير من أي جهاز وأصدر فواتيرك بلمسة واحدة باحترافية كاملة', color: '#f59e0b' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 110}>
                <div className="lift" style={{ background: '#fff', border: '1.5px solid #e9ecf1', borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', height: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateZ(24px) translateY(-4px)'; e.currentTarget.style.boxShadow = `0 24px 50px ${s.color}22` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)' }}>
                  <div className="num" style={{ width: 54, height: 54, background: s.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 22, fontWeight: 900, color: '#fff', boxShadow: `0 8px 24px ${s.color}55` }}>{s.n}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: DARK }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.85 }}>{s.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT THE SUBSCRIPTION INCLUDES ── */}
      <section style={{ background: DARK, padding: '80px 6vw', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 50% 50%, rgba(22,166,121,0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>ماذا يشمل الاشتراك</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20, textAlign: 'center' }}>
            {[
              { n: `${TRIAL_DAYS} يوماً`, label: 'تجربة مجانية قبل الدفع' },
              { n: 'تابلت', label: 'مع الاشتراك السنوي' },
              { n: 'غير محدود', label: 'منتجات وموظفين وفواتير' },
              { n: 'واتساب', label: 'دعم مباشر بالعربية' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div style={{ padding: '20px 0' }}>
                  <div className="num" style={{ fontSize: 'clamp(24px,2.6vw,36px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{s.n}</div>
                  <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.42)', marginTop: 8, lineHeight: 1.6 }}>{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '100px 6vw', background: '#f8fafc' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>الأسعار</div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, color: DARK }}>سعر واحد بدون مفاجآت</h2>
            <p style={{ fontSize: 16, color: '#64748b', marginBottom: 56 }}>
              جرّب شهراً كاملاً قبل أن تدفع — والدفع بالتحويل البنكي
            </p>
          </Reveal>
          <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20, alignItems: 'stretch' }}>
            {[
              {
                plan: 'تجربة مجانية',
                price: `${TRIAL_DAYS}`,
                period: 'يوماً — بدون دفع',
                highlight: false,
                features: ['كل مميزات النظام', 'بدون بطاقة ائتمان', 'بياناتك تبقى لك بعد التجربة'],
                cta: 'ابدأ التجربة',
                onClick: () => router.push('/register'),
              },
              {
                plan: 'سنوي',
                price: sar(YEARLY_PRICE),
                period: 'ر.س / سنة',
                highlight: true,
                features: ['تابلت مع الاشتراك', 'مخزون وكاشير وتقارير', 'منتجات وموظفون غير محدودين', 'دعم عبر واتساب', 'كل التحديثات مجاناً'],
                cta: 'اطلب الاشتراك',
                onClick: () => { window.location.href = WHATSAPP },
              },
              {
                plan: 'المؤسسات',
                price: 'تواصل',
                period: 'معنا',
                highlight: false,
                features: ['تدريب وإعداد على الموقع', 'مدير حساب مخصص', 'تطوير حسب احتياج المنشأة'],
                cta: 'تواصل معنا',
                onClick: () => { window.location.href = WHATSAPP },
              },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="lift" style={{
                  background: p.highlight ? DARK : '#fff',
                  border: p.highlight ? `2px solid ${G}` : '1.5px solid #e2e8f0',
                  borderRadius: 22, padding: '36px 28px', position: 'relative',
                  boxShadow: p.highlight ? '0 28px 64px rgba(15,23,42,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}
                  onMouseMove={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    const px = (e.clientX - r.left) / r.width - 0.5
                    const py = (e.clientY - r.top) / r.height - 0.5
                    e.currentTarget.style.transform = `translateZ(34px) rotateX(${-py * 6}deg) rotateY(${px * 6}deg)`
                  }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                  {p.highlight && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: G, color: '#fff', borderRadius: 99, padding: '4px 20px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>الأكثر اختياراً</div>}
                  <div style={{ fontSize: 14, fontWeight: 600, color: p.highlight ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 10 }}>{p.plan}</div>
                  <div className="num" style={{ fontSize: 44, fontWeight: 900, color: p.highlight ? '#fff' : DARK, letterSpacing: '-2px', lineHeight: 1 }}>{p.price}</div>
                  <div style={{ fontSize: 13, color: p.highlight ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginBottom: 28, marginTop: 6 }}>{p.period}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, textAlign: 'right', flex: 1 }}>
                    {p.features.map((f, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, color: p.highlight ? 'rgba(255,255,255,0.8)' : '#374151', lineHeight: 1.6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M20 6L9 17l-5-5"/></svg>
                        {f}
                      </div>
                    ))}
                  </div>
                  <button onClick={p.onClick}
                    style={{ width: '100%', background: p.highlight ? G : 'transparent', border: `2px solid ${p.highlight ? G : '#e2e8f0'}`, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: p.highlight ? '#fff' : '#374151', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (p.highlight) e.currentTarget.style.background = GD; else { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af' } }}
                    onMouseLeave={e => { if (p.highlight) e.currentTarget.style.background = G; else { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0' } }}>
                    {p.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '90px 6vw', background: '#fff' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>الأسئلة الشائعة</div>
              <h2 style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 900, letterSpacing: '-1px', color: DARK }}>أسئلة تخطر في بالك</h2>
            </div>
          </Reveal>
          {[
            { q: 'كيف أدفع؟', a: 'بالتحويل البنكي. تواصل معنا على واتساب بعد التجربة ونفعّل حسابك مباشرة.' },
            { q: `وش يصير بعد ${TRIAL_DAYS} يوماً؟`, a: 'بياناتك تبقى كما هي. إذا لم تشترك، يتوقف الدخول للنظام ولا تُحذف بياناتك — تشترك في أي وقت وتكمل من حيث توقفت.' },
            { q: 'التابلت ملك لي؟', a: 'يُسلَّم مع الاشتراك السنوي لتشغيل الكاشير. تفاصيل الجهاز والتسليم نتفق عليها عند الاشتراك.' },
            { q: 'هل أحتاج خبرة تقنية للبدء؟', a: 'لا — صُمم النظام ليكون بسيطاً. تقدر تبدأ بدون أي تدريب مسبق.' },
            { q: 'هل يعمل على الآيباد والجوال؟', a: 'نعم، يعمل على أي جهاز ومتصفح — جوال، تابلت، وكمبيوتر.' },
            { q: 'كيف يتزامن الكاشير مع المخزون؟', a: 'عند إصدار أي فاتورة، يُخصم المخزون تلقائياً بناءً على مكونات الوصفة فوراً.' },
            { q: 'هل بياناتي آمنة؟', a: 'بياناتك في قاعدة بيانات سحابية، والاتصال مشفّر، وكل مخبز معزول عن غيره — لا يرى أحد بيانات مخبزك.' },
            { q: 'هل يمكنني إضافة أكثر من موظف؟', a: 'نعم، عدد غير محدود من الموظفين مع تحديد صلاحيات كل واحد منهم.' },
          ].map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                style={{ width: '100%', background: 'none', border: 'none', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: DARK, textAlign: 'right', gap: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
                {faq.q}
              </button>
              <div style={{
                maxHeight: openFaq === i ? 220 : 0,
                opacity: openFaq === i ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.28s ease, opacity 0.2s ease',
              }}>
                <div style={{ paddingBottom: 22, fontSize: 15, color: '#64748b', lineHeight: 1.85 }}>{faq.a}</div>
              </div>
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
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 44, lineHeight: 1.75 }}>
            شهر كامل تجربة مجانية — بدون بطاقة ائتمان، وبدون التزام
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')}
              style={{ background: G, border: 'none', borderRadius: 12, padding: '15px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', boxShadow: `0 8px 32px rgba(22,166,121,0.45)`, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = GD; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = G; e.currentTarget.style.transform = 'translateY(0)' }}>
              ابدأ التجربة المجانية
            </button>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '15px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(255,255,255,0.75)', transition: 'all 0.2s', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}>
              كلّمنا على واتساب
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#070b14', padding: '56px 6vw 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 40, paddingBottom: 44, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 28 }}>
            <div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.6px' }}>Bake<span style={{ color: G }}>x</span></span>
              </div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.85, maxWidth: 240 }}>حلول متكاملة لإدارة المخابز السعودية من المخزون حتى الكاشير.</p>
            </div>
            {[
              { title: 'المنتج', links: [{ l: 'المميزات', id: 'features' }, { l: 'الحاسبة', id: 'calculator' }, { l: 'الأسعار', id: 'pricing' }, { l: 'كيف يعمل', id: 'how' }] },
              { title: 'الدعم', links: [{ l: 'الأسئلة الشائعة', id: 'faq' }] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>{col.title}</div>
                {col.links.map(l => (
                  <div key={l.l}
                    onClick={() => document.getElementById(l.id)?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', marginBottom: 12, cursor: 'pointer', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>{l.l}</div>
                ))}
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>تواصل</div>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
                واتساب
              </a>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div className="num" style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }} suppressHydrationWarning>© {new Date().getFullYear()} Bakex — جميع الحقوق محفوظة</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>صُنع في السعودية</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
