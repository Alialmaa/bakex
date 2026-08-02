import Head from 'next/head'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The shell the three policy pages share.
 *
 * They are public and static on purpose: a payment gateway or a Maroof reviewer
 * has to be able to read them without an account, and a customer has to be able
 * to read them before deciding to pay.
 */

const GREEN = '#16a679'

export const LEGAL_PAGES = [
  { href: '/terms', title: 'الشروط والأحكام' },
  { href: '/refund', title: 'سياسة الاسترجاع والإلغاء' },
  { href: '/privacy', title: 'سياسة الخصوصية' },
] as const

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sec">
      <h2>{title}</h2>
      {children}
      <style jsx>{`
        .sec { margin-bottom: 30px }
        h2 {
          font-size: 17px; font-weight: 800; color: #0b0f1a;
          margin: 0 0 10px; letter-spacing: -0.3px;
        }
      `}</style>
    </section>
  )
}

export default function LegalPage({
  title, updated, intro, children, whatsapp, email,
}: {
  title: string
  /** The date the text last actually changed, not today's date. */
  updated: string
  intro?: string
  children: ReactNode
  whatsapp: string
  email: string
}) {
  return (
    <div dir="rtl" className="wrap">
      <Head>
        <title>{`${title} — Bakex`}</title>
        <meta name="description" content={`${title} لنظام Bakex لإدارة المخابز.`} />
      </Head>

      <header className="top">
        <Link href="/" className="brand">Bake<span style={{ color: GREEN }}>x</span></Link>
        <Link href="/" className="back">العودة للرئيسية</Link>
      </header>

      <main className="page">
        <h1>{title}</h1>
        <div className="updated num">آخر تحديث: {updated}</div>
        {intro && <p className="intro">{intro}</p>}

        <div className="body">{children}</div>

        <div className="contact">
          <div className="contact-title">للتواصل</div>
          <p>لأي استفسار بخصوص هذه الصفحة أو لطلب يتعلق ببياناتك:</p>
          <ul className="channels">
            <li>
              البريد الإلكتروني:{' '}
              <a href={`mailto:${email}`} dir="ltr">{email}</a>
            </li>
            <li>
              واتساب:{' '}
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="num" dir="ltr">
                +{whatsapp}
              </a>
            </li>
          </ul>
        </div>

        <nav className="others">
          {LEGAL_PAGES.filter(p => p.title !== title).map(p => (
            <Link key={p.href} href={p.href} className="other">{p.title}</Link>
          ))}
        </nav>
      </main>

      <footer className="foot">
        <span className="num">© {new Date().getFullYear()} Bakex</span>
        <span>صُنع في السعودية</span>
      </footer>

      <style jsx>{`
        .wrap {
          min-height: 100vh; background: #f6f8fb;
          font-family: var(--font-ui); color: #0b0f1a;
          display: flex; flex-direction: column;
        }
        .top {
          background: #fff; border-bottom: 1px solid #e8ecf1;
          padding: 14px 24px; display: flex; align-items: center; justify-content: space-between;
        }
        .brand { font-weight: 800; font-size: 19px; letter-spacing: -0.5px; text-decoration: none; color: #0b0f1a }
        .back {
          font-size: 13px; font-weight: 600; color: #475569; text-decoration: none;
          border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 7px 16px;
        }
        .back:hover { border-color: ${GREEN}; color: ${GREEN} }

        .page { flex: 1; max-width: 780px; width: 100%; margin: 36px auto 60px; padding: 0 20px }
        h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.8px; margin: 0 0 6px }
        .updated { font-size: 12.5px; color: #94a3b8; font-weight: 600; margin-bottom: 20px }
        .intro {
          font-size: 14.5px; line-height: 1.9; color: #475569;
          background: #fff; border: 1px solid #e8ecf1; border-radius: 12px;
          padding: 16px 18px; margin: 0 0 28px;
        }
        .body {
          background: #fff; border: 1px solid #e8ecf1; border-radius: 14px;
          padding: 26px 24px;
        }

        .contact {
          background: rgba(22,166,121,.06); border: 1px solid rgba(22,166,121,.2);
          border-radius: 12px; padding: 16px 18px; margin-top: 20px;
        }
        .contact-title { font-size: 14px; font-weight: 700; margin-bottom: 6px }
        .contact p { font-size: 14px; margin: 0 0 8px; color: #374151 }
        .channels { margin: 0; padding-inline-start: 20px }
        .channels li { font-size: 14px; line-height: 2; color: #374151 }
        .channels a { color: ${GREEN} }

        .others { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px }
        .other {
          font-size: 13px; font-weight: 600; color: #475569; text-decoration: none;
          background: #fff; border: 1.5px solid #e2e8f0; border-radius: 99px; padding: 7px 16px;
        }
        .other:hover { border-color: ${GREEN}; color: ${GREEN} }

        .foot {
          border-top: 1px solid #e8ecf1; background: #fff;
          padding: 18px 24px; display: flex; justify-content: space-between;
          font-size: 12.5px; color: #94a3b8; flex-wrap: wrap; gap: 8px;
        }
      `}</style>

      <style jsx global>{`
        .legal-body p, .legal-body li { font-size: 14.5px; line-height: 2; color: #374151 }
        .legal-body p { margin: 0 0 12px }
        .legal-body ul { margin: 0 0 14px; padding-inline-start: 20px }
        .legal-body li { margin-bottom: 7px }
        .legal-body strong { color: #0b0f1a; font-weight: 700 }
        .legal-body a { color: ${GREEN} }
        .legal-body .note {
          background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px;
          padding: 12px 14px; font-size: 13.5px; color: #92400e; line-height: 1.9;
        }
      `}</style>
    </div>
  )
}
