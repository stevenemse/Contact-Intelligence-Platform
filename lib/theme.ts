'use client'

/**
 * Source de vérité du thème : l'attribut data-theme de <html>
 * (posé avant peinture par le script inline du layout racine).
 */
export function isDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.theme === 'dark'
}

const listeners = new Set<() => void>()

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Applique le thème partout : <html>, cookie (relecture serveur) et localStorage. */
export function setTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.cookie = `theme=${dark ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`
  try { window.localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* stockage indisponible */ }
  for (const listener of listeners) listener()
}
