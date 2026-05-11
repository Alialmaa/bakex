import { useState, useEffect } from 'react'
import { Lang } from './translations'

export function useLang() {
  const [lang, setLangState] = useState<Lang>('ar')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('bakex_lang') : null
    if (saved === 'ar' || saved === 'en') setLangState(saved)
    setMounted(true)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('bakex_lang', l)
  }

  return { lang, setLang, mounted }
}
