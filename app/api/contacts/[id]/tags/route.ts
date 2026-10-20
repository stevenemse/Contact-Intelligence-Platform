import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({ tagId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  const { id } = await params
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const db = serviceDb()!

  // le tag appartient à l'organisation ?
  const { data: tag } = await db.from('tags').select('id')
    .eq('organization_id', ctx.orgId).eq('id', body.tagId).maybeSingle()
  if (!tag) return NextResponse.json({ error: 'Tag introuvable' }, { status: 404 })

  // le contact appartient à l'organisation ?
  const { data: contact } = await db.from('contacts').select('id')
    .eq('organization_id', ctx.orgId).eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  const existing = await db.from('contact_tags').select('id')
    .eq('organization_id', ctx.orgId).eq('contact_id', id).eq('tag_id', body.tagId).maybeSingle()
  if (existing.data) {
    const { error } = await db.from('contact_tags').delete().eq('id', (existing.data as { id: string }).id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'contact.tag_removed', 'contact', id, { tagId: body.tagId })
    return NextResponse.json({ ok: true, attached: false })
  }

  const { error } = await db.from('contact_tags').insert({
    organization_id: ctx.orgId, contact_id: id, tag_id: body.tagId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(ctx.orgId, ctx.userId, 'contact.tag_added', 'contact', id, { tagId: body.tagId })
  return NextResponse.json({ ok: true, attached: true })
}
