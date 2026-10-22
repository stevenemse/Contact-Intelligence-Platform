'use client'

import { useEffect, useState } from 'react'

/** Date du jour rendue côté navigateur sans instabilité de prerender. */
export default function TodayLabel({ locale = 'fr-FR' }: { locale?: string }) {
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToday(new Date().toLocaleDateString(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [locale])

  return <span>{today ?? ''}</span>
}
