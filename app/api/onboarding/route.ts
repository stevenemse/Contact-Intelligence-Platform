import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { getAuthUser, serviceDb } from '@/lib/supabase/server'
import { quotaForPlan } from '@/lib/plans'

const bodySchema = z.object({ name: z.string().min(1).max(120) })

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Nom invalide' }, { status: 400 })
  }

  const db = serviceDb()!
  const name = body.name.trim()
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)}-${Math.random().toString(36).slice(2, 7)}`

  const { data: org, error: orgErr } = await db
    .from('organizations')
    .insert({
      name,
      slug,
      plan: 'free',
      contact_quota: quotaForPlan('free'),
      owner_user_id: user.id,
    })
    .select('id')
    .single()
  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message ?? 'Création impossible' }, { status: 500 })
  }

  const { error: memErr } = await db.from('memberships').insert({
    organization_id: org.id,
    user_id: user.id,
    email: user.email,
    name: user.name ?? '',
    role: 'owner',
  })
  if (memErr) {
    // rollback best-effort
    await db.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }

  await db.from('activity_logs').insert({
    organization_id: org.id,
    action: 'workspace.created',
    entity: 'organization',
    entity_id: org.id,
    uid: user.id,
    details: { name },
  })

  const store = await cookies()
  store.set('active_org', org.id, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return NextResponse.json({ ok: true, orgId: org.id })
}
