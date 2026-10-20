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
  const [locale, setLocale] = useState<Locale>(initial ?? DEFAULT_LOCALE)
  return (
    <Ctx.Provider value={{ locale, t: getDictionary(locale), setLocale }}>
      {children}
    </Ctx.Provider>
  )
}

export function useI18n() {
  return useContext(Ctx)
}
