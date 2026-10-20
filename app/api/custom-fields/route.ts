import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const addSchema = z.object({ action: z.literal('add'), label: z.string().min(1).max(120), type: z.enum(['text', 'number', 'date', 'boolean']) })
const delSchema = z.object({ action: z.literal('delete'), fieldId: z.string().uuid() })
const bodySchema = z.union([addSchema, delSchema])

function toKey(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
}

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
    const label = body.label.trim()
    const key = toKey(label)
    if (!key) return NextResponse.json({ error: 'Libellé invalide' }, { status: 400 })
    const { data: dup } = await db.from('custom_fields').select('id')
      .eq('organization_id', ctx.orgId).eq('key', key).limit(1).maybeSingle()
    if (dup) return NextResponse.json({ error: 'Cette clé existe déjà' }, { status: 409 })
    const { error } = await db.from('custom_fields').insert({
      organization_id: ctx.orgId, label, key, type: body.type,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'custom_field.created', 'custom_field', null, { label, key, type: body.type })
    return NextResponse.json({ ok: true, key })
  }

  const { error } = await db.from('custom_fields').delete().eq('organization_id', ctx.orgId).eq('id', body.fieldId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(ctx.orgId, ctx.userId, 'custom_field.deleted', 'custom_field', body.fieldId, {})
  return NextResponse.json({ ok: true })
}
