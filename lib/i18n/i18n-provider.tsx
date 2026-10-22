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
      const saved = window.localStorage.getItem('locale')
      if (saved === 'fr' || saved === 'en') return saved
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
