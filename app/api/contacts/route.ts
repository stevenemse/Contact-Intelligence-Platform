import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({ delete: z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }) })

export async function DELETE(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const db = serviceDb()!
  const ids = body.delete.ids
  // suppression en cascade des relations (FK on delete cascade)
  const { error } = await db.from('contacts').delete().eq('organization_id', ctx.orgId).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(ctx.orgId, ctx.userId, 'contacts.bulk_delete', 'contact', null, { count: ids.length })
  return NextResponse.json({ ok: true, count: ids.length })
}
