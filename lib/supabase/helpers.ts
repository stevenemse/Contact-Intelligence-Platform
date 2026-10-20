/** Convertit une valeur SQL potentiellement nulle en string sûre. */
export function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Convertit une valeur SQL potentiellement nulle en nombre sûr. */
export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
