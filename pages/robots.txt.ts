import type { GetServerSideProps } from 'next'
import { PRIVATE_PREFIXES, canonical } from '../lib/seo'
import { appBaseUrl } from '../lib/appUrl'

/**
 * robots.txt, generated so it can answer differently on a preview.
 *
 * Preview deployments serve the same pages on a vercel.app hostname. Left
 * crawlable they compete with the real site for the same words and split its
 * signals, so anything that is not the configured origin refuses everything.
 */

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  let productionHost = ''
  try { productionHost = new URL(appBaseUrl()).host } catch { /* falls through to blocking */ }

  const host = (req.headers.host || '').toLowerCase()
  const isProductionHost =
    !!productionHost &&
    (host === productionHost.toLowerCase() || host === `www.${productionHost}`.toLowerCase())

  const body = isProductionHost
    ? [
        'User-agent: *',
        // The application itself has nothing to rank for and every path in it
        // redirects a crawler to the login page.
        ...PRIVATE_PREFIXES.map(p => `Disallow: ${p}`),
        'Allow: /',
        '',
        `Sitemap: ${canonical('/sitemap.xml')}`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n')

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.write(body)
  res.end()

  return { props: {} }
}

export default function Robots() { return null }
