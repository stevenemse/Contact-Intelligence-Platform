/** Drapeau emoji depuis un code ISO2 (2 lettres → 2 points de code régionaux). */
export const toFlag = (iso2: string): string => {
  if (iso2.length !== 2) return '🏳'
  const A = 127397
  return String.fromCodePoint(A + iso2.charCodeAt(0)) + String.fromCodePoint(A + iso2.charCodeAt(1))
}
