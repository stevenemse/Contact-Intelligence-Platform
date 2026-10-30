import { NextResponse, type NextRequest } from 'next/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { PLAN_IDS, quotaForPlan, ENTERPRISE_MAX_QUOTA } from '@/lib/plans'
import { nextPeriodEnd } from '@/lib/billing/subscription'

/**
 * Attribution d'un plan par le super-admin, pour une durée choisie.
 *
 * Sans Stripe, c'est ici que se joue le cycle de vie commercial : on accorde
 * ou renouvelle un plan pour N mois (1 = mensuel par défaut) et l'échéance est
 * écrite dans `current_period_end`. Un renouvellement anticipé s'empile sur
 * l'échéance en cours. Passer au plan `free` met fin à l'abonnement tout de suite.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isSuperAdmin(ctx.email)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { plan?: string; months?: number; contacts?: number }
  const plan = String(body.plan ?? '')
  if (!(PLAN_IDS as string[]).includes(plan)) {
    return NextResponse.json({ error: 'Plan inconnu' }, { status: 400 })
  }

  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  const { data: current } = await db
    .from('organizations')
    .select('plan, current_period_end')
    .eq('id', id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const now = new Date()
  let periodEnd: string | null = null
  if (plan !== 'free') {
    const asked = Number(body.months)
    const months = Number.isFinite(asked) && asked > 0 ? Math.min(36, Math.round(asked)) : 1
    periodEnd = nextPeriodEnd(current.current_period_end, months, now).toISOString()
  }

  // Quota de contacts : celui du plan ; pour enterprise, le palier choisi
  // par l'admin (100k, 1M, personnalisé ou -1 illimité) plutôt qu'un -1 implicite.
  let contactQuota = quotaForPlan(plan)
  if (plan === 'enterprise') {
    const asked = Number((body as { contacts?: number }).contacts)
    if (asked === -1) contactQuota = -1
    else if (Number.isFinite(asked) && asked >= 1_000 && asked <= ENTERPRISE_MAX_QUOTA) contactQuota = Math.round(asked)
  }

  const { error } = await db.from('organizations').update({
    plan,
    contact_quota: contactQuota,
    // `none` = pas d'abonnement, `active` = accordé avec échéance.
    // Un grant sans échéance garde `manual_grant` (héritage, illimité).
    subscription_status: plan === 'free' ? 'none' : 'active',
    current_period_end: periodEnd,
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Journal : le renouvellement d'un même plan s'y voit aussi (from = to).
  const { error: logErr } = await db.from('plan_changes').insert({
    organization_id: id,
    from_plan: current.plan ?? null,
    to_plan: plan,
    source: 'admin',
    actor_email: ctx.email,
  })
  // Le journal ne doit pas faire échouer une attribution déjà enregistrée.
  if (logErr) console.error('[admin/plan] plan_changes:', logErr.message)

  return NextResponse.json({
    ok: true,
    plan,
    subscriptionStatus: plan === 'free' ? 'none' : 'active',
    currentPeriodEnd: periodEnd,
  })
}
