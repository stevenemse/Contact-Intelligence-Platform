import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const addSchema = z.object({ action: z.literal('add'), name: z.string().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
const delSchema = z.object({ action: z.literal('delete'), tagId: z.string().uuid() })
const bodySchema = z.union([addSchema, delSchema])

export async function POST(req: NextRequest) {
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

  if (body.action === 'add') {
    const name = body.name.trim().replace(/^#/, '')
    const { data: dup } = await db.from('tags').select('id')
      .eq('organization_id', ctx.orgId).eq('name', name).limit(1).maybeSingle()
    if (dup) return NextResponse.json({ error: 'Ce tag existe déjà' }, { status: 409 })
    const { error } = await db.from('tags').insert({
      organization_id: ctx.orgId, name, color: body.color,
    })
    if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'tag.created', 'tag', null, { name })
    return NextResponse.json({ ok: true })
  }

  const { error } = await db.from('tags').delete().eq('organization_id', ctx.orgId).eq('id', body.tagId)
  if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })
  await logActivity(ctx.orgId, ctx.userId, 'tag.deleted', 'tag', body.tagId, {})
  return NextResponse.json({ ok: true })
}
