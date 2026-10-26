'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_LOCALE, getDictionary, type Locale } from '@/lib/i18n/dictionaries'

type I18nCtx = {
  locale: Locale
  t: ReturnType<typeof getDictionary>
  setLocale: (l: Locale) => void
}

const Ctx = createContext<I18nCtx>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
  setLocale: () => {},
})

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initial) return initial
    // Repli cookie : même source que cookies() côté serveur.
    if (typeof document !== 'undefined') {
      const cookie = document.cookie.split('; ').find(c => c.startsWith('locale='))?.slice(7)
      if (cookie === 'fr' || cookie === 'en') return cookie
    }
    return DEFAULT_LOCALE
  })
  const setLocale = (next: Locale) => {
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('locale', next)
      document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
    }
  }
  // Garde <html lang> aligné sur la langue affichée (lecteurs d'écran, SEO).
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return (
    <Ctx.Provider value={{ locale, t: getDictionary(locale), setLocale }}>
      {children}
    </Ctx.Provider>
  )
}

export function useI18n() {
  return useContext(Ctx)
}
