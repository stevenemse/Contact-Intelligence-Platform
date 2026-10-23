import 'flag-icons/css/flag-icons.min.css'

/**
 * Drapeau SVG réel (lib flag-icons, auto-hébergé) — rendu identique sur toutes
 * les plateformes, contrairement aux emojis Unicode que Windows n'affiche pas.
 */
export default function Flag({ iso2, size = 16, className = '' }: {
  iso2: string
  size?: number
  className?: string
}) {
  const code = iso2.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) {
    return <span className={className} style={{ display: 'inline-block', width: size, height: size }} aria-hidden="true">🏳</span>
  }
  return (
    <span
      className={`fi fi-${code.toLowerCase()} ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        borderRadius: '50%',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        verticalAlign: '-0.125em',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(13, 38, 33, .12)',
      }}
      aria-hidden="true"
    />
  )
}
