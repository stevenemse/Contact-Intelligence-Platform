import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({
  memberId: z.string().uuid(),
  newRole: z.enum(['admin', 'manager', 'member', 'viewer']),
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
  const { data: member } = await db.from('memberships').select('role')
    .eq('organization_id', ctx.orgId).eq('id', body.memberId).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  const role = String((member as { role: string }).role ?? 'viewer')
  if (role === 'owner') {
    return NextResponse.json({ error: 'Le rôle du propriétaire ne peut pas être modifié.' }, { status: 403 })
  }

  const { error } = await db.from('memberships')
    .update({ role: body.newRole })
    .eq('organization_id', ctx.orgId).eq('id', body.memberId)
  if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })

  await logActivity(ctx.orgId, ctx.userId, 'team.role_changed', 'member', body.memberId, { newRole: body.newRole })
  return NextResponse.json({ ok: true })
}
