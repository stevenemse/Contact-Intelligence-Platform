'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
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
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('locale')
      if (stored === 'fr' || stored === 'en') return stored
      // Repli sur le cookie serveur : aligne les composants clients
      // (pricing, etc.) sur la locale déjà rendue côté serveur.
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
  return (
    <Ctx.Provider value={{ locale, t: getDictionary(locale), setLocale }}>
      {children}
    </Ctx.Provider>
  )
}

export function useI18n() {
  return useContext(Ctx)
}
