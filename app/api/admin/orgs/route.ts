import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isSuperAdmin(ctx.email)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  const { data, error } = await db.from('organizations')
    .select('id, name, plan, contact_quota, subscription_status, current_period_end, stripe_customer_id, billing_email, created_at, contacts(count)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    createdAt: o.created_at,
    contactCount: o.contacts?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ orgs })
}
