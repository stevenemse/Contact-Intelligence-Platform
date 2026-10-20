import type { ReactNode } from 'react'

// route bloquante (session + cookies) : validation instant-navigation désactivée
export const instant = false
import { requireOrg } from '@/lib/supabase/org-context'
import { getDictionary } from '@/lib/i18n/dictionaries'
import Sidebar from '@/components/sidebar'
import Logo from '@/components/logo'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrg()
  const t = getDictionary('fr')

  return (
    <div className="app-shell">
      <Sidebar orgName={ctx.orgName} role={ctx.role} labels={t.nav} email={ctx.email} />
      <div className="main-area">
        <header className="flex md:hidden items-center justify-between glass-nav" style={{ paddingLeft: 64, paddingRight: 16 }}>
          <Logo />
        </header>
        {children}
      </div>
    </div>
  )
}
