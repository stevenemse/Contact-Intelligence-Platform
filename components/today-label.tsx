'use client'

import { useEffect, useState } from 'react'

/**
 * Date du jour rendue côté navigateur : évite l'instabilité de `new Date()`
 * pendant le prerender (Next 16 + cacheComponents).
 */
export default function TodayLabel({ locale = 'fr-FR' }: { locale?: string }) {
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [locale])

  // Rendu initial neutre (identique serveur/client) : pas de mismatch d'hydratation.
  return <span>{today ?? ''}</span>
}
