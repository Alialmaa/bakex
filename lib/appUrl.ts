/**
 * The application's own origin, for links sent to users by email.
 *
 * Never derive this from the request. Verification and password-reset links
 * used to be built from `req.headers.host`, which the caller controls: posting
 * to /api/auth/forgot-password with `Host: attacker.com` and a victim's address
 * mailed that victim a genuine-looking message, from the real sending domain,
 * carrying a live reset token pointed at the attacker's server. Clicking it
 * handed over the account.
 *
 * Set APP_URL in the environment (e.g. https://bakexsystem.com). Localhost is
 * allowed only outside production so the dev flow still works.
 */
const FALLBACK = 'https://bakexsystem.com'

export function appBaseUrl(): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'
  return FALLBACK
}

export const appUrl = (path: string) =>
  `${appBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
