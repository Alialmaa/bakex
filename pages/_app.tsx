import type { AppProps } from 'next/app'
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
