import { NextResponse, type NextRequest } from 'next/server'
import { getOrgContext, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { getPlan, isPaidPlan } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canAdmin(ctx)) return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const planId = String((body as { plan?: string }).plan ?? '')

  if (!isPaidPlan(planId)) {
    return NextResponse.json({ error: 'Plan non souscriptible en ligne' }, { status: 400 })
  }
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({
      error: "Stripe non configuré : ajoutez STRIPE_SECRET_KEY dans les variables d'environnement.",
      setup: true,
    }, { status: 503 })
  }
  const plan = getPlan(planId)
  const priceId = process.env[plan.priceEnv!]
  if (!priceId) {
    return NextResponse.json({
      error: `Prix Stripe manquant : définissez ${plan.priceEnv} (ID du Price ${planId}).`,
      setup: true,
    }, { status: 503 })
  }

  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  const { data: org } = await db.from('organizations')
    .select('id, name, stripe_customer_id, billing_email')
    .eq('id', ctx.orgId)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  let customerId = (org as { stripe_customer_id?: string | null }).stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: (org as { billing_email?: string | null }).billing_email || ctx.email,
      name: (org as { name?: string | null }).name || undefined,
      metadata: { organization_id: ctx.orgId },
    })
    customerId = customer.id
    await db.from('organizations').update({ stripe_customer_id: customerId }).eq('id', ctx.orgId)
  }

  const origin = req.nextUrl.origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { organization_id: ctx.orgId, plan: planId } },
    metadata: { organization_id: ctx.orgId, plan: planId },
    success_url: `${origin}/settings/billing?success=1`,
    cancel_url: `${origin}/settings/billing?canceled=1`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
