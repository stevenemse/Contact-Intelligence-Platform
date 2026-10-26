import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'

// Espace plateforme : dépend de la session (rôle super-admin), jamais pré-rendu.
export const instant = false

/**
 * Habillage de l'espace d'administration, distinct de « Mon espace » :
 * pas de sidebar produit, un bandeau qui dit clairement où l'on est et
 * un retour direct au workspace.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const fr = (await cookies()).get('locale')?.value !== 'en'

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <span className="admin-badge">Admin</span>
          <span className="admin-topbar-title">
            {fr ? 'Plateforme — gestion des espaces' : 'Platform — workspace management'}
          </span>
        </div>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">
          {fr ? '← Mon espace' : '← My workspace'}
        </Link>
      </header>
      {children}
    </div>
  )
}
