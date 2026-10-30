import { redirect } from 'next/navigation'
import { requireOrg } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { getDictionary } from '@/lib/i18n/dictionaries'
import AdminBilling, { type AdminStats, type RecentAccount } from '@/components/admin-billing'
import { resolveSubscription } from '@/lib/billing/subscription'

export const instant = false

/**
 * Seuil « 30 derniers jours ». Calcul via un helper hors composant : la règle
 * react-hooks/purity interdit d'appeler Date.now() pendant le rendu, et cette
 * page est dynamique (instant = false), donc recalculée à chaque requête.
 */
function since30Iso(): string {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
}

export default async function AdminPage() {
  const ctx = await requireOrg()
  if (!isSuperAdmin(ctx.email)) redirect('/dashboard')

  const db = serviceDb()
  const t = getDictionary('fr')

  // Sans clé serveur, la liste sortirait vide sans explication : on dit plutôt
  // quoi faire, sinon on croit que l'admin est cassé.
  if (!db) {
    return (
      <div className="p-4 md:p-8 space-y-4" style={{ maxWidth: 780 }}>
        <div className="dashboard-header">
          <p className="eyebrow">{t.admin.title}</p>
          <h1 className="display-1">{t.admin.title}</h1>
        </div>
        <div className="alert-error">
          Administration indisponible : la clé serveur Supabase n&apos;est pas configurée.
          Ajoutez <b>SUPABASE_SERVICE_ROLE_KEY</b> (Supabase → Project Settings → API)
          puis redéployez.
        </div>
      </div>
    )
  }

  const since30 = since30Iso()

  // Comptages exacts indépendants de la liste des organisations (limitée à 500)
  const [orgCount, memberCount, memberCount30, contactCount, importCount, exportCount, recentMemberships, orgsRes] =
    await Promise.all([
      db.from('organizations').select('id', { count: 'exact', head: true }),
      db.from('memberships').select('id', { count: 'exact', head: true }),
      db.from('memberships').select('id', { count: 'exact', head: true }).gte('created_at', since30),
      db.from('contacts').select('id', { count: 'exact', head: true }),
      db.from('import_batches').select('id', { count: 'exact', head: true }),
      db.from('export_runs').select('id', { count: 'exact', head: true }),
      db.from('memberships')
        .select('email, name, role, created_at, organizations(name, plan)')
        .order('created_at', { ascending: false })
        .limit(8),
      db.from('organizations')
        .select('id, name, plan, contact_quota, subscription_status, current_period_end, stripe_customer_id, billing_email, created_at, contacts(count)')
        .order('created_at', { ascending: false })
        .limit(500),
    ])

  const stats: AdminStats = {
    orgs: orgCount.count ?? 0,
    orgsNew: 0, // rempli après lecture des organisations récentes
    accounts: memberCount.count ?? 0,
    accountsNew: memberCount30.count ?? 0,
    contacts: contactCount.count ?? 0,
    imports: importCount.count ?? 0,
    exports: exportCount.count ?? 0,
  }

  const orgs = ((orgsRes.data ?? []) as unknown as {
    id: string; created_at: string
    name: string | null; plan: string | null; contact_quota: number | null
    subscription_status: string | null; current_period_end: string | null
    stripe_customer_id: string | null; billing_email: string | null
    contacts: { count: number }[]
  }[]).map(o => ({
    id: o.id,
    created_at: o.created_at,
    name: o.name ?? '—',
    plan: o.plan ?? 'free',
    contactQuota: o.contact_quota ?? 0,
    subscriptionStatus: o.subscription_status ?? 'none',
    currentPeriodEnd: o.current_period_end,
    hasStripe: !!o.stripe_customer_id,
    billingEmail: o.billing_email,
    contactCount: o.contacts?.[0]?.count ?? 0,
    // Échéance comparée à maintenant côté serveur : le client n'a plus à
    // manipuler d'horloge pour afficher « expiré » ou les jours restants.
    subscription: resolveSubscription({
      plan: o.plan,
      subscription_status: o.subscription_status,
      current_period_end: o.current_period_end,
    }),
  }))
  // organisations créées sur les 30 derniers jours
  const since30Num = Date.parse(since30)
  stats.orgsNew = orgs.filter(o => Date.parse(o.created_at) >= since30Num).length

  const recentAccounts: RecentAccount[] = ((recentMemberships.data ?? []) as unknown as {
    email: string | null; name: string | null; role: string | null; created_at: string
    organizations: { name: string | null; plan: string | null }[] | { name: string | null; plan: string | null } | null
  }[]).map(m => {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    return {
      email: m.email ?? '—',
      name: m.name,
      role: m.role ?? '—',
      orgName: org?.name ?? '—',
      orgPlan: org?.plan ?? '—',
      createdAt: m.created_at,
    }
  })

  const { error: orgsError } = orgsRes

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="dashboard-header">
        <p className="eyebrow">{t.admin.title}</p>
        <h1 className="display-1">{t.admin.title}</h1>
        <p className="subtitle-page mt-1">{t.admin.sub}</p>
      </div>

      {/* KPIs plateforme */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Organisations', value: stats.orgs, hint: `${stats.orgsNew} sur 30 jours` },
          { label: 'Comptes membres', value: stats.accounts, hint: `${stats.accountsNew} sur 30 jours`, href: undefined },
          { label: 'Contacts', value: stats.contacts, hint: 'toutes organisations' },
          { label: 'Imports', value: stats.imports, hint: 'toutes organisations' },
          { label: 'Exports', value: stats.exports, hint: 'toutes organisations' },
        ].map(k => (
          <div key={k.label} className="kpi-card dashboard-kpi">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="metric mt-1">{k.value.toLocaleString('fr-FR')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Comptes créés récemment */}
      <div className="kpi-card">
        <h3 className="section-title">Comptes créés récemment</h3>
        <table className="data-table">
          <thead>
            <tr><th>Membre</th><th>Espace</th><th>Plan</th><th>Rôle</th><th>Créé le</th></tr>
          </thead>
          <tbody>
            {recentAccounts.map(m => (
              <tr key={`${m.email}-${m.createdAt}-${m.orgName}`}>
                <td>
                  <div className="font-medium">{m.name || m.email}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.name ? m.email : '—'}</div>
                </td>
                <td>{m.orgName}</td>
                <td><span className="badge badge-teal">{m.orgPlan}</span></td>
                <td><span className="badge">{m.role}</span></td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
            {recentAccounts.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-faint)' }}>Aucun compte</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminBilling initialOrgs={orgs} myEmail={ctx.email} />
      {(orgsError) && (
        <div className="alert-error">
          Lecture des données impossible : {orgsError.message}
        </div>
      )}
    </div>
  )
}
