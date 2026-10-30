import type { ReactNode } from 'react'
import { cookies } from 'next/headers'

// route bloquante (session + cookies) : validation instant-navigation désactivée
export const instant = false
import { requireOrg, canAdmin } from '@/lib/supabase/org-context'
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries'
import Sidebar from '@/components/sidebar'
import Logo from '@/components/logo'
import { isSuperAdmin } from '@/lib/super-admin'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrg()
  const locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'fr'
  getDictionary(locale as Locale)

  // Bandeau d'échéance : seuls les responsables d'espace voient l'état
  // commercial, et seulement s'il y a quelque chose à faire.
  const sub = ctx.subscription
  const periodEnd = sub.periodEnd
    ? new Date(sub.periodEnd).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')
    : ''
  const showExpired = canAdmin(ctx) && sub.status === 'expired'
  const showSoon = canAdmin(ctx) && sub.status === 'active' && (sub.daysLeft ?? 99) <= 7

  return (
    <div className="app-shell">
      <Sidebar orgName={ctx.orgName} role={ctx.role} email={ctx.email} plan={ctx.orgPlan} showAdmin={isSuperAdmin(ctx.email)} />
      <div className="main-area">
        <header className="glass-nav app-topbar">
          <div className="topbar-left">
            <Logo />
          </div>
        </header>
        {showExpired && (
          <div className="alert-error" role="status" style={{ margin: '12px 16px 0' }}>
            {locale === 'fr'
              ? `Abonnement expiré le ${periodEnd} : l’espace fonctionne en plan gratuit (données conservées). Demandez le renouvellement à votre administrateur.`
              : `Subscription expired on ${periodEnd}: the workspace runs on the free plan (data kept). Ask your administrator to renew it.`}
          </div>
        )}
        {showSoon && (
          <div className="alert-warning" role="status" style={{ margin: '12px 16px 0' }}>
            {locale === 'fr'
              ? `Abonnement ${ctx.orgPlan} à renouveler : il expire le ${periodEnd} (${sub.daysLeft} jour${sub.daysLeft === 1 ? '' : 's'} restant${sub.daysLeft === 1 ? '' : 's'}).`
              : `${ctx.orgPlan} subscription ends on ${periodEnd} (${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'} left).`}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
