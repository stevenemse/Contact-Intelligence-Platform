// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canAdmin, isOwner } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings-form'

export default async function SettingsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let contactCount = 0
  if (db) {
    const { count } = await db.from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
    contactCount = count ?? 0
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Espace de travail, plan et quota de contacts.
        </p>
      </div>

      <SettingsForm
        isOwner={isOwner(ctx)}
        isAdmin={canAdmin(ctx)}
        orgName={ctx.orgName}
        plan={ctx.orgPlan}
        quota={ctx.quota}
        contactCount={contactCount}
      />

      {isOwner(ctx) && (
        <div className="glass-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title mb-2">Abonnement</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Plan actuel : <span className="badge badge-blue">{ctx.orgPlan}</span> · quota {ctx.quota.toLocaleString('fr-FR')} contacts.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Comparez les plans ou mettez votre espace à niveau depuis la page Abonnement.
              </p>
            </div>
            <Link href="/settings/billing" className="btn btn-primary btn-sm">Gérer l&apos;abonnement</Link>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Besoin de gérer l&apos;équipe ? <Link href="/team" className="underline">Section Équipe</Link>.
      </p>
    </div>
  )
}
