import { requireOrg, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import BillingPanel from '@/components/billing-panel'
import { resolveSubscription } from '@/lib/billing/subscription'

export const instant = false

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string }> }) {
  const ctx = await requireOrg()
  const sp = await searchParams
  const t = getDictionary('fr')
  const db = serviceDb()

  const { data: org } = await db?.from('organizations')
    .select('plan, contact_quota, subscription_status, current_period_end, stripe_customer_id')
    .eq('id', ctx.orgId)
    .maybeSingle() ?? { data: null }

  const orgRow = (org ?? {}) as {
    plan?: string | null; contact_quota?: number | null; subscription_status?: string | null
    current_period_end?: string | null; stripe_customer_id?: string | null
  }

  const subscription = resolveSubscription(orgRow)

  return (
    <div className="p-4 md:p-8 space-y-6" style={{ maxWidth: 780 }}>
      <div className="dashboard-header">
        <p className="eyebrow">{t.billing.title}</p>
        <h1 className="display-1">{t.billing.title}</h1>
      </div>
      <BillingPanel
        canManage={canAdmin(ctx)}
        quota={ctx.quota}
        hasStripeCustomer={!!orgRow.stripe_customer_id}
        subscription={subscription}
        stripeEnabled={!!process.env.STRIPE_SECRET_KEY}
        flag={sp.success ? 'success' : sp.canceled ? 'canceled' : null}
      />
    </div>
  )
}
