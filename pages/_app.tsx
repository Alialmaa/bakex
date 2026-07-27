import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Plus_Jakarta_Sans, Tajawal } from 'next/font/google'
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
      `}</style>
      <Component {...pageProps} />
    </>
  )
}
