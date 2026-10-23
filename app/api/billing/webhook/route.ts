import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { serviceDb } from '@/lib/supabase/server'
import { quotaForPlan } from '@/lib/plans'

/** Webhook Stripe (appelé par les serveurs Stripe — pas de session utilisateur). */
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const db = serviceDb()
  if (!stripe || !secret || !db) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  // API Stripe ≥ 2025 : la fin de période vit sur l'item d'abonnement
  const periodEndOf = (sub: Stripe.Subscription): Date | null => {
    const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined
    const ts = item?.current_period_end
    return ts ? new Date(ts * 1000) : null
  }

  const applyPlan = async (organizationId: string | null, customerId: string | null, patch: {
    plan?: string
    status: string
    periodEnd: Date | null
  }) => {
    let orgId = organizationId
    if (!orgId && customerId) {
      const { data } = await db.from('organizations').select('id')
        .eq('stripe_customer_id', customerId).maybeSingle()
      orgId = ((data as { id?: string } | null)?.id) ?? null
    }
    if (!orgId) return
    const update: Record<string, unknown> = {
      subscription_status: patch.status,
      current_period_end: patch.periodEnd ? patch.periodEnd.toISOString() : null,
    }
    if (patch.plan) {
      update.plan = patch.plan
      update.contact_quota = quotaForPlan(patch.plan)
    }
    await db.from('organizations').update(update).eq('id', orgId)
    if (patch.plan) {
      const { data: current } = await db.from('organizations').select('plan')
        .eq('id', orgId).maybeSingle()
      await db.from('plan_changes').insert({
        organization_id: orgId,
        from_plan: ((current as { plan?: string } | null)?.plan) ?? null,
        to_plan: patch.plan,
        source: 'stripe',
        actor_email: null,
      })
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const orgId = (session.metadata?.organization_id) ?? null
      const plan = session.metadata?.plan ?? null
      if (session.status === 'complete' && orgId) {
        await db.from('organizations')
          .update({ stripe_customer_id: String(session.customer ?? '') })
          .eq('id', orgId)
        const sub = await stripe.subscriptions.retrieve(String(session.subscription))
        await applyPlan(orgId, null, {
          plan: plan ?? undefined,
          status: sub.status,
          periodEnd: periodEndOf(sub),
        })
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await applyPlan(null, String(sub.customer), {
        plan: (sub.metadata?.plan as string | undefined),
        status: sub.status,
        periodEnd: periodEndOf(sub),
      })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await applyPlan(null, String(sub.customer), { plan: 'free', status: 'canceled', periodEnd: null })
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
