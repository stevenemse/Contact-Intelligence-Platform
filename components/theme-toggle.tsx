'use client'

import { useSyncExternalStore } from 'react'
import { isDark, setTheme, subscribeTheme } from '@/lib/theme'

function IconSun() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 15, height: 15 }}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.8M10 16.2V18M18 10h-1.8M3.8 10H2M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3M15.7 15.7l-1.3-1.3M5.6 5.6L4.3 4.3" strokeLinecap="round" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 15, height: 15 }}>
      <path d="M17 12.3A7.3 7.3 0 017.7 3 7.4 7.4 0 003 9.6c0 4.1 3.3 7.4 7.4 7.4 3 0 5.5-1.8 6.6-4.7z" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Bascule mode jour / mode nuit. Le thème est appliqué avant peinture par le
 * script inline du layout racine (localStorage) ; ce bouton le lit et le
 * change via le store partagé (data-theme sur <html> + cookie + localStorage).
 */
export default function ThemeToggle({ className = '', style }: {
  className?: string
  style?: React.CSSProperties
}) {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false)

  return (
    <button
      onClick={() => setTheme(!dark)}
      className={`nav-item ${className}`}
      style={style}
      aria-pressed={dark}
      aria-label={dark ? 'Passer en mode jour' : 'Passer en mode nuit'}
      title={dark ? 'Mode jour' : 'Mode nuit'}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  )
}
