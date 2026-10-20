import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({
  keeperId: z.string().uuid(),
  mergedIds: z.array(z.string().uuid()).min(1).max(20),
})

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
  if (body.mergedIds.includes(body.keeperId)) {
    return NextResponse.json({ error: 'Le conservé ne peut pas être fusionné' }, { status: 400 })
  }

  const db = serviceDb()!
  const org = ctx.orgId

  // fiches pour le journal d'audit
  const { data: keeper } = await db.from('contacts').select('*').eq('organization_id', org).eq('id', body.keeperId).maybeSingle()
  if (!keeper) return NextResponse.json({ error: 'Contact conservé introuvable' }, { status: 404 })
  const { data: dupes } = await db.from('contacts').select('*').eq('organization_id', org).in('id', body.mergedIds)
  if (!dupes || dupes.length === 0) return NextResponse.json({ error: 'Contacts à fusionner introuvables' }, { status: 404 })

  const keptValues = {
    fullName: (keeper as { full_name: string | null }).full_name,
    company: (keeper as { company: string | null }).company,
    jobTitle: (keeper as { job_title: string | null }).job_title,
    source: (keeper as { source: string | null }).source,
  }

  for (const dup of dupes as Record<string, unknown>[]) {
    const dupId = String(dup.id)
    // transfert des sous-entités vers le conservé
    await db.from('contact_phones').update({ contact_id: body.keeperId }).eq('organization_id', org).eq('contact_id', dupId)
    await db.from('contact_emails').update({ contact_id: body.keeperId }).eq('organization_id', org).eq('contact_id', dupId)
    await db.from('contact_tags').update({ contact_id: body.keeperId }).eq('organization_id', org).eq('contact_id', dupId)
    await db.from('contact_changes').update({ contact_id: body.keeperId }).eq('organization_id', org).eq('contact_id', dupId)

    // marque + log
    await db.from('contacts')
      .update({ merged_into: body.keeperId, updated_at: new Date().toISOString() })
      .eq('organization_id', org).eq('id', dupId)
    await db.from('merge_logs').insert({
      organization_id: org,
      keeper_id: body.keeperId,
      merged_id: dupId,
      kept_values: keptValues,
      discarded_values: {
        fullName: dup.full_name ?? null, company: dup.company ?? null,
        jobTitle: dup.job_title ?? null, source: dup.source ?? null,
      },
      merged_by: ctx.userId,
    })
  }

  await logActivity(org, ctx.userId, 'duplicates.merged', 'contact', body.keeperId, {
    merged: body.mergedIds,
  })

  return NextResponse.json({ ok: true, merged: body.mergedIds.length })
}
