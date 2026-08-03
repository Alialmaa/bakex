import type { GetServerSideProps } from 'next'
import { PUBLIC_PATHS, canonical } from '../lib/seo'
import { appBaseUrl } from '../lib/appUrl'

/**
 * The sitemap, generated rather than kept as a file in `public/`.
 *
 * A hand-written sitemap.xml goes stale the first time a page is added and
 * nobody notices, because nothing fails. This one is built from the same list
 * the rest of the app uses, so a page cannot be public and missing from it.
 *
 * Only public pages are listed. Everything behind a login has nothing to rank
 * for, and pointing a crawler at it spends crawl budget on redirects.
 */

const isProduction = () => {
  try {
    return new URL(appBaseUrl()).hostname !== 'localhost'
  } catch {
    return false
  }
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const lastmod = new Date().toISOString().slice(0, 10)

  const urls = PUBLIC_PATHS.map(p => [
    '  <url>',
    `    <loc>${canonical(p.path)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${p.changefreq}</changefreq>`,
    `    <priority>${p.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n')

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '\n</urlset>\n'

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  // Cheap to regenerate and rarely changes, but not worth serving stale for
  // long after a page is added.
  res.setHeader('Cache-Control', isProduction() ? 'public, max-age=3600, s-maxage=86400' : 'no-store')
  res.write(xml)
  res.end()

  return { props: {} }
}

export default function Sitemap() { return null }
