import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Plus_Jakarta_Sans, Tajawal } from 'next/font/google'
import { LangProvider } from '../lib/useLang'
import '../styles/globals.css'

// Self-hosted at build time by next/font, so the strict CSP in next.config.js
// (style-src 'self', font-src 'self') keeps applying — no external font requests.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  /**
   * Every page is server-rendered, so a navigation waits on a request before
   * anything changes on screen — and nothing said so. The console showed
   * "Loading initial props cancelled", which is Next reporting a route change
   * abandoned because another started: clicks during the silence.
   */
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    const start = () => setNavigating(true)
    const stop = () => setNavigating(false)
    router.events.on('routeChangeStart', start)
    router.events.on('routeChangeComplete', stop)
    router.events.on('routeChangeError', stop)
    return () => {
      router.events.off('routeChangeStart', start)
      router.events.off('routeChangeComplete', stop)
      router.events.off('routeChangeError', stop)
    }
  }, [router])

  return (
    <>
      <Head>
        {/* The app shipped with no favicon, so browsers drew their default grey
            globe. This is the Bakex mark — inline SVG data-URI so no separate
            request is made and the strict CSP is unaffected. */}
        <link
          rel="icon"
          href={
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
              '<rect width="64" height="64" rx="14" fill="#0f172a"/>' +
              '<text x="32" y="45" font-family="Segoe UI,Arial,sans-serif" font-size="34" ' +
              'font-weight="800" text-anchor="middle" letter-spacing="-1">' +
              '<tspan fill="#ffffff">B</tspan><tspan fill="#16a679">x</tspan></text></svg>'
            )
          }
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      {/* Bind the generated font families to CSS vars so globals.css and any
          inline fontFamily can reference them by a stable name. */}
      <style jsx global>{`
        :root {
          --font-latin: ${jakarta.style.fontFamily};
          --font-arabic: ${tajawal.style.fontFamily};
          --font-ui: var(--font-latin), var(--font-arabic), -apple-system,
            BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .route-progress {
          position: fixed;
          top: 0;
          inset-inline: 0;
          height: 3px;
          z-index: 9999;
          background: transparent;
          pointer-events: none;
        }
        .route-progress span {
          display: block;
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #16a679, #34d399);
          transform-origin: 0 50%;
          animation: route-progress-grow 1.4s cubic-bezier(0.1, 0.6, 0.2, 1) forwards;
        }
        /* Approaches the far edge without reaching it: the request decides when
           it is done, and the bar is removed at that moment. */
        @keyframes route-progress-grow {
          0%   { transform: scaleX(0.02); }
          40%  { transform: scaleX(0.55); }
          100% { transform: scaleX(0.9); }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-progress span { animation: none; transform: scaleX(0.6); }
        }
      `}</style>
      {navigating && <div className="route-progress" aria-hidden="true"><span /></div>}
      {/* The language state lives here rather than in each page, so a client-side
          navigation cannot reset it to Arabic for a frame. requirePage() puts the
          cookie's value on `user`, so the server already rendered the right one. */}
      <LangProvider initialLang={pageProps?.user?.lang}>
        <Component {...pageProps} />
      </LangProvider>
    </>
  )
}
