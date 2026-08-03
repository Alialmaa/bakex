import Head from 'next/head'
import { PAGE_SEO, SITE_NAME, canonical, type SeoKey } from '../lib/seo'

/**
 * The tags that decide what Google prints and what a pasted link looks like.
 *
 * Open Graph is here for a practical reason as much as a search one: the link
 * is shared on WhatsApp and LinkedIn, and without these tags it arrives as a
 * bare URL with no title, no description and no picture.
 */

/**
 * Search Console's HTML verification token. NEXT_PUBLIC_ because it has to be
 * inlined at build time: read from the server-only environment it would render
 * during SSR and vanish on hydration, which is exactly the mismatch that makes
 * verification fail intermittently. The token is not a secret — it only proves
 * ownership to Google.
 */
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

export default function Seo({ page, path }: { page: SeoKey; path: string }) {
  const meta = PAGE_SEO[page]
  const url = canonical(path)
  const noindex = 'noindex' in meta && meta.noindex

  return (
    <Head>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />

      {/* A login screen has nothing to rank for, and indexing it wastes the
          crawl budget that should go to the pages that sell. */}
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="ar_SA" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />

      {GOOGLE_VERIFICATION && <meta name="google-site-verification" content={GOOGLE_VERIFICATION} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Head>
  )
}
