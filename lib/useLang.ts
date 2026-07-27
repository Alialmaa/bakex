import { createContext, createElement, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Lang } from './translations'
import { LANG_COOKIE, DEFAULT_LANG, LANG_MAX_AGE, parseLang } from './lang'

/**
 * The language lives in one place, above the page.
 *
 * It used to be per-page state seeded with 'ar' and corrected from localStorage
 * in an effect. Every page mounted its own copy, so each client-side navigation
 * rendered Arabic RTL for a frame and then flipped to the stored language —
 * a full mirror-image jump of the whole layout on every click.
 *
 * Now the state sits in _app, so it survives navigation, and it is seeded from a
 * cookie the server can read, so the first paint is already correct.
 */
interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
  mounted: boolean
}

const LangContext = createContext<LangState | null>(null)

const writeCookie = (l: Lang) => {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${LANG_MAX_AGE}; samesite=lax`
}

export function LangProvider({ initialLang, children }: { initialLang?: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? DEFAULT_LANG)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Public pages have no server-side session to carry the choice, and users
    // who chose a language before this change have it in localStorage only.
    // Either way, adopt it once and write the cookie so the server sees it next
    // time. Nothing to do for anyone who already has the cookie.
    const fromCookie = parseLang(document.cookie)
    if (fromCookie) {
      if (fromCookie !== lang) setLangState(fromCookie)
      return
    }
    const legacy = localStorage.getItem(LANG_COOKIE)
    const saved = legacy === 'ar' || legacy === 'en' ? (legacy as Lang) : null
    const adopt = saved ?? lang
    writeCookie(adopt)
    if (adopt !== lang) setLangState(adopt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    writeCookie(l)
    // Kept in step so a browser that blocks cookies still remembers the choice.
    try { localStorage.setItem(LANG_COOKIE, l) } catch {}
  }, [])

  return createElement(LangContext.Provider, { value: { lang, setLang, mounted } }, children)
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  // Every page renders inside _app's provider. The fallback keeps a stray
  // caller rendering rather than crashing.
  if (!ctx) return { lang: DEFAULT_LANG, setLang: () => {}, mounted: false }
  return ctx
}
