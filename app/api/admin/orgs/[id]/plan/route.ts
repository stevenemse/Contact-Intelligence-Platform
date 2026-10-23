import { NextResponse, type NextRequest } from 'next/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { PLAN_IDS, quotaForPlan } from '@/lib/plans'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isSuperAdmin(ctx.email)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { plan?: string }
  const plan = String(body.plan ?? '')
  if (!(PLAN_IDS as string[]).includes(plan)) {
    return NextResponse.json({ error: 'Plan inconnu' }, { status: 400 })
  }

  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  const { data: current } = await db.from('organizations').select('plan').eq('id', id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const { error } = await db.from('organizations').update({
    plan,
    contact_quota: quotaForPlan(plan),
    // plan accordé manuellement : le webhook Stripe le remplacera si un abonnement réel existe
    subscription_status: plan === 'free' ? 'none' : 'manual_grant',
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('plan_changes').insert({
    organization_id: id,
    from_plan: ((current as { plan?: string } | null)?.plan) ?? null,
    to_plan: plan,
    source: 'admin',
    actor_email: ctx.email,
  })

  return NextResponse.json({ ok: true })
}
