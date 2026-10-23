import { NextResponse, type NextRequest } from 'next/server'
import { getOrgContext, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canAdmin(ctx)) return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré', setup: true }, { status: 503 })
  }
  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  const { data: org } = await db.from('organizations')
    .select('stripe_customer_id')
    .eq('id', ctx.orgId)
    .maybeSingle()
  const customerId = (org as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ error: 'Aucun abonnement Stripe pour cette organisation.' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${req.nextUrl.origin}/settings/billing`,
  })
  return NextResponse.json({ url: session.url })
}
