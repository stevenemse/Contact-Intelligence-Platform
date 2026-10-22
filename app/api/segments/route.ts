import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const ruleSchema = z.object({
  field: z.string().max(60),
  op: z.enum(['eq', 'neq', 'contains', 'starts_with', 'is_empty', 'not_empty', 'gt', 'lt']),
  value: z.string().max(200).optional(),
})
const groupSchema = z.object({
  and: z.array(ruleSchema).max(50).default([]),
  or: z.array(ruleSchema).max(50).default([]),
  not: z.array(ruleSchema).max(50).default([]),
})
const addSchema = z.object({
  action: z.literal('add'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  rules: z.array(groupSchema).min(1).max(20),
})
const delSchema = z.object({ action: z.literal('delete'), segmentId: z.string().uuid() })
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
    const { data: seg, error } = await db.from('segments').insert({
      organization_id: ctx.orgId,
      name: body.name.trim(),
      description: body.description ?? null,
      rules: body.rules,
      created_by: ctx.userId,
    }).select('id').single()
    if (error || !seg) return NextResponse.json({ error: 'Création impossible.' }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'segment.created', 'segment', seg.id, { name: body.name.trim() })
    return NextResponse.json({ ok: true, id: seg.id })
  }

  const { error } = await db.from('segments').delete().eq('organization_id', ctx.orgId).eq('id', body.segmentId)
  if (error) return NextResponse.json({ error: 'Suppression impossible.' }, { status: 500 })
  await logActivity(ctx.orgId, ctx.userId, 'segment.deleted', 'segment', body.segmentId, {})
  return NextResponse.json({ ok: true })
}
