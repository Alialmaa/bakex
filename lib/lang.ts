import type { Lang } from './translations'

/**
 * Where the language choice lives.
 *
 * It used to be localStorage only, which the server cannot read — so every
 * render started in Arabic and switched after mount. A cookie is sent with the
 * request, so the server can render the right language the first time.
 */
export const LANG_COOKIE = 'bakex_lang'
export const DEFAULT_LANG: Lang = 'ar'
export const LANG_MAX_AGE = 60 * 60 * 24 * 365

export function parseLang(cookieHeader?: string | null): Lang | null {
  if (!cookieHeader) return null
  const m = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(ar|en)(?:;|$)`).exec(cookieHeader)
  return m ? (m[1] as Lang) : null
}
