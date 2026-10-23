import type { ReactNode } from 'react'
import { cookies } from 'next/headers'

// route bloquante (session + cookies) : validation instant-navigation désactivée
export const instant = false
import { requireOrg } from '@/lib/supabase/org-context'
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries'
import Sidebar from '@/components/sidebar'
import Logo from '@/components/logo'
import { isSuperAdmin } from '@/lib/super-admin'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrg()
  const locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'fr'
  getDictionary(locale as Locale)

  return (
    <div className="app-shell">
      <Sidebar orgName={ctx.orgName} role={ctx.role} email={ctx.email} plan={ctx.orgPlan} showAdmin={isSuperAdmin(ctx.email)} />
      <div className="main-area">
        <header className="glass-nav app-topbar">
          <div className="topbar-left">
            <Logo />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
