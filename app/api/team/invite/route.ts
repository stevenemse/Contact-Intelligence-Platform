import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
})

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canAdmin(ctx)) return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const db = serviceDb()!
  const email = body.email.toLowerCase()
  const { data: member } = await db.from('memberships').select('id')
    .eq('organization_id', ctx.orgId).eq('email', email).limit(1).maybeSingle()
  if (member) return NextResponse.json({ error: 'Ce membre fait déjà partie de l\'espace.' }, { status: 409 })
  const { data: dup } = await db.from('org_invites').select('id')
    .eq('organization_id', ctx.orgId).eq('email', email).eq('status', 'pending').limit(1).maybeSingle()
  if (dup) return NextResponse.json({ error: 'Cette personne est déjà invitée.' }, { status: 409 })

  const { error } = await db.from('org_invites').insert({
    organization_id: ctx.orgId,
    email,
    role: body.role,
    status: 'pending',
    invited_by: ctx.userId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(ctx.orgId, ctx.userId, 'team.invited', 'invite', email, { role: body.role })
  return NextResponse.json({ ok: true })
}
