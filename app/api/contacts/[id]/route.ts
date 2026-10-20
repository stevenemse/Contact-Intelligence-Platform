import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({
  first_name: z.string().max(120).nullable().optional(),
  last_name: z.string().max(120).nullable().optional(),
  full_name: z.string().max(240).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  job_title: z.string().max(200).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  country_iso2: z.string().max(2).nullable().optional(),
  country_name: z.string().max(120).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { data: before } = await db.from('contacts').select('*').eq('organization_id', ctx.orgId).eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  const patch: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  const { error } = await db.from('contacts').update(patch).eq('organization_id', ctx.orgId).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // historique : champs modifiés (diff). Sera affiché sur la fiche du contact.
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    const oldV = (before as Record<string, unknown>)[k] ?? null
    if ((oldV ?? '') !== (v ?? '')) fields[k] = oldV
  }
  if (Object.keys(fields).length > 0) {
    await db.from('contact_changes').insert({ organization_id: ctx.orgId, contact_id: id, fields })
    await logActivity(ctx.orgId, ctx.userId, 'contact.updated', 'contact', id, { fields: Object.keys(fields) })
  }

  return NextResponse.json({ ok: true })
}
