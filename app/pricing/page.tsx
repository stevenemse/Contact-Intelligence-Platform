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
          <ThemeToggle className="btn btn-ghost btn-sm nav-toggle" style={{ justifyContent: 'center' }} />
          <LanguageToggle className="btn btn-ghost btn-sm nav-toggle" style={{ justifyContent: 'center' }} />
          {ctx
            ? <Link href="/dashboard" className="btn btn-primary btn-sm">{locale === 'fr' ? 'Mon espace' : 'My workspace'}</Link>
            : <Link href="/register" className="btn btn-primary btn-sm">{t.landingFull.start}</Link>}
        </nav>
      </header>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 32px 80px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 12px' }}>
          {t.pricing.title}
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
          {t.pricing.sub}
        </p>

        {/* Signal de confiance sous le titre */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, margin: '20px auto 40px', fontSize: 12.5, color: 'var(--text-muted)' }}>
          {t.pricing.trust.map((txt, i) => (
            <span key={txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 13, height: 13, color: 'var(--brand-deep)', flexShrink: 0 }} aria-hidden="true">
                {i === 0 ? (
                  <><rect x="4.5" y="8.5" width="11" height="8" rx="2"/><path d="M7 8.5V6a3 3 0 016 0v2.5" strokeLinecap="round"/></>
                ) : i === 1 ? (
                  <><path d="M10 2l6 2.5v4c0 4-2.6 7.4-6 8.5-3.4-1.1-6-4.5-6-8.5v-4L10 2z" strokeLinejoin="round"/><path d="M7.4 10l1.8 1.8 3.4-3.6" strokeLinecap="round" strokeLinejoin="round"/></>
                ) : (
                  <><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M3 6l7 5 7-5" strokeLinecap="round" strokeLinejoin="round"/></>
                )}
              </svg>
              {txt}
            </span>
          ))}
        </div>

        <PricingCards currentPlan={ctx?.orgPlan ?? null} />

        <p style={{ margin: '32px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>{t.pricing.note}</p>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 32px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
        {t.landingFull.footer}
      </footer>
    </main>
  )
}
