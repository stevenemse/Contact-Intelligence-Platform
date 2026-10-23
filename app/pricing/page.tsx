import { cookies } from 'next/headers'
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries'
import { getAuthUser } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import PricingCards from '@/components/pricing-cards'
import ThemeToggle from '@/components/theme-toggle'
import LanguageToggle from '@/components/language-toggle'
import Link from 'next/link'

export const instant = false

export default async function PricingPage() {
  const store = await cookies()
  const locale = store.get('locale')?.value === 'en' ? 'en' : 'fr'
  const t = getDictionary(locale as Locale)

  const user = await getAuthUser()
  const ctx = user ? await getOrgContext() : null

  return (
    <main className="landing-hero-bg min-h-screen">
      <header className="landing-nav" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 64, borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--brand-light),var(--brand))',
            display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 13, color: 'white',
          }}>CI</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }} translate="no">Contact Intelligence</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} />
          <LanguageToggle className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} />
          {ctx
            ? <Link href="/dashboard" className="btn btn-primary btn-sm">{locale === 'fr' ? 'Mon espace' : 'My workspace'}</Link>
            : <Link href="/register" className="btn btn-primary btn-sm">{t.landingFull.start}</Link>}
        </nav>
      </header>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 32px 80px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 12px' }}>
          {t.pricing.title}
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
          {t.pricing.sub}
        </p>
        <PricingCards currentPlan={ctx?.orgPlan ?? null} />
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 32px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
        {t.landingFull.footer}
      </footer>
    </main>
  )
}
