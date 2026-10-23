'use client'

import { useI18n } from '@/lib/i18n/i18n-provider'

function IconGlobe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16" />
    </svg>
  )
}

/** Bascule FR/EN réutilisable (landing, sidebar, pricing…). */
export default function LanguageToggle({ className = '', style }: {
  className?: string
  style?: React.CSSProperties
}) {
  const { locale, setLocale } = useI18n()

  function toggle() {
    const next = locale === 'fr' ? 'en' : 'fr'
    setLocale(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('locale', next)
      document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
    }
  }

  return (
    <button onClick={toggle} className={className} style={style} aria-label="Changer de langue / Switch language">
      <IconGlobe />
      {locale === 'fr' ? 'EN' : 'FR'}
    </button>
  )
}
