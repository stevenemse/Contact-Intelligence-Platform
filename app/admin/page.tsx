import { redirect } from 'next/navigation'
import { requireOrg } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { getDictionary } from '@/lib/i18n/dictionaries'
import AdminBilling from '@/components/admin-billing'

export const instant = false

export default async function AdminPage() {
  const ctx = await requireOrg()
  if (!isSuperAdmin(ctx.email)) redirect('/dashboard')

  const db = serviceDb()
  const t = getDictionary('fr')

  const { data } = await db?.from('organizations')
    .select('id, name, plan, contact_quota, subscription_status, current_period_end, stripe_customer_id, billing_email, created_at, contacts(count)')
    .order('created_at', { ascending: false })
    .limit(500) ?? { data: null }

  const orgs = ((data ?? []) as unknown as {
    id: string; name: string | null; plan: string | null; contact_quota: number | null
    subscription_status: string | null; current_period_end: string | null
    stripe_customer_id: string | null; billing_email: string | null; created_at: string
    contacts: { count: number }[]
  }[]).map(o => ({
    id: o.id,
    name: o.name ?? '—',
    plan: o.plan ?? 'free',
    contactQuota: o.contact_quota ?? 0,
    subscriptionStatus: o.subscription_status ?? 'none',
    currentPeriodEnd: o.current_period_end,
    hasStripe: !!o.stripe_customer_id,
    billingEmail: o.billing_email,
    contactCount: o.contacts?.[0]?.count ?? 0,
  }))

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="dashboard-header">
        <p className="eyebrow">{t.admin.title}</p>
        <h1 className="display-1">{t.admin.title}</h1>
        <p className="subtitle-page mt-1">{t.admin.sub}</p>
      </div>
      <AdminBilling initialOrgs={orgs} myEmail={ctx.email} />
    </div>
  )
}
