// route publique (composant serveur : lit la session pour lier les CTA)

import Link from 'next/link'
import { cookies } from 'next/headers'
import { getAuthUser } from '@/lib/supabase/server'
import ThemeToggle from '@/components/theme-toggle'
import LanguageToggle from '@/components/language-toggle'

/**
 * Barre de navigation publique, structure SaaS :
 * logo à gauche · liens centrés au milieu · actions à droite.
 * Grille 1fr auto 1fr : les liens restent visuellement centrés même si les
 * côtés n'ont pas la même largeur. Partagée par landing, /pricing et /contact.
 */
export default async function SiteNav() {
  const store = await cookies()
  const loc = store.get('locale')?.value === 'en' ? 'en' : 'fr'
  const user = await getAuthUser()

  const links = [
    { href: '/pricing', label: loc === 'fr' ? 'Tarifs' : 'Pricing' },
    { href: '/contact', label: loc === 'fr' ? 'Contact' : 'Contact' },
  ]

  return (
    <header className="landing-nav" style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16,
      padding: '0 32px', height: 64, borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* bloc gauche : logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'start' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--brand-light),var(--brand))',
            display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 13, color: 'white',
          }}>CI</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }} translate="no">Contact Intelligence</span>
        </Link>
      </div>

      {/* bloc centre : liens SaaS centrés */}
      <nav aria-label={loc === 'fr' ? 'Navigation principale' : 'Main navigation'} style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'center' }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} className="btn btn-ghost btn-sm nav-link-pill">{l.label}</Link>
        ))}
      </nav>

      {/* bloc droite : bascules + auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'end' }}>
        <ThemeToggle className="btn btn-ghost btn-sm nav-toggle" style={{ justifyContent: 'center' }} />
        <LanguageToggle className="btn btn-ghost btn-sm nav-toggle" style={{ justifyContent: 'center' }} />
        {user ? (
          <Link href="/dashboard" className="btn btn-primary btn-sm">{loc === 'fr' ? 'Mon espace' : 'My workspace'}</Link>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost btn-sm">{loc === 'fr' ? 'Se connecter' : 'Sign in'}</Link>
            <Link href="/register" className="btn btn-primary btn-sm">{loc === 'fr' ? 'Commencer gratuitement' : 'Start for free'}</Link>
          </>
        )}
      </div>
    </header>
  )
}
