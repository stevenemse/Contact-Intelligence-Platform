import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canAdmin } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({ name: z.string().min(1).max(120) })

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
  const { error } = await db.from('organizations')
    .update({ name: body.name.trim() })
    .eq('id', ctx.orgId)
  if (error) return NextResponse.json({ error: 'Modification impossible.' }, { status: 500 })

  await logActivity(ctx.orgId, ctx.userId, 'settings.org_renamed', 'organization', ctx.orgId, { name: body.name.trim() })
  return NextResponse.json({ ok: true })
}
