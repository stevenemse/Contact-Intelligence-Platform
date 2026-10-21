import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'
import { str } from '@/lib/supabase/helpers'

const bodySchema = z.object({
  keeperId: z.string().uuid(),
  mergedIds: z.array(z.string().uuid()).min(1).max(20),
})

type PhoneRow = { id: string; normalized_phone: string | null }
type EmailRow = { id: string; email: string | null }
type TagRow = { tag_id: string }
type DupRow = {
  id: string
  full_name: string | null
  company: string | null
  job_title: string | null
  source: string | null
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
  if (body.mergedIds.includes(body.keeperId)) {
    return NextResponse.json({ error: 'Le conservé ne peut pas être fusionné' }, { status: 400 })
  }

  const db = serviceDb()!
  const org = ctx.orgId
  const keeperId = body.keeperId

  // fiches pour le journal d'audit
  const { data: keeper } = await db.from('contacts').select('*').eq('organization_id', org).eq('id', keeperId).maybeSingle()
  if (!keeper) return NextResponse.json({ error: 'Contact conservé introuvable' }, { status: 404 })
  const { data: dupes } = await db.from('contacts').select('*').eq('organization_id', org).in('id', body.mergedIds)
  if (!dupes || dupes.length === 0) return NextResponse.json({ error: 'Contacts à fusionner introuvables' }, { status: 404 })

  const keeperRow = keeper as unknown as DupRow
  const keptValues = {
    fullName: keeperRow.full_name,
    company: keeperRow.company,
    jobTitle: keeperRow.job_title,
    source: keeperRow.source,
  }
  const keeperCompany = str(keeperRow.company).trim()

  // état du conservé : on évite les doublons de numéros / emails / tags et on garde
  // un seul numéro principal sur la fiche finale.
  const { data: keeperPhonesRaw } = await db.from('contact_phones')
    .select('id, normalized_phone, is_primary').eq('organization_id', org).eq('contact_id', keeperId)
  const keeperPhones = (keeperPhonesRaw ?? []) as unknown as (PhoneRow & { is_primary: boolean | null })[]
  const phoneSet = new Set(keeperPhones.map(p => str(p.normalized_phone)).filter(Boolean))
  let hasPrimaryPhone = keeperPhones.some(p => Boolean(p.is_primary))

  const { data: keeperEmailsRaw } = await db.from('contact_emails')
    .select('id, email, is_primary').eq('organization_id', org).eq('contact_id', keeperId)
  const keeperEmails = (keeperEmailsRaw ?? []) as unknown as (EmailRow & { is_primary: boolean | null })[]
  const emailSet = new Set(keeperEmails.map(e => str(e.email).toLowerCase()).filter(Boolean))
  let hasPrimaryEmail = keeperEmails.some(e => Boolean(e.is_primary))

  const { data: keeperTagsRaw } = await db.from('contact_tags')
    .select('tag_id').eq('organization_id', org).eq('contact_id', keeperId)
  const tagSet = new Set(((keeperTagsRaw ?? []) as unknown as TagRow[]).map(t => str(t.tag_id)))

  // entreprises / fonctions rencontrées : jamais perdues, même si la fiche absorbée disparaît des listes
  const extraCompanies = new Set<string>()
  const extraJobTitles = new Set<string>()
  const absorbedSummary: { id: string; name: string; company: string; jobTitle: string }[] = []

  for (const dup of dupes as unknown as DupRow[]) {
    const dupId = str(dup.id)
    const dupCompany = str(dup.company).trim()
    const dupJobTitle = str(dup.job_title).trim()
    if (dupCompany && dupCompany !== keeperCompany) extraCompanies.add(dupCompany)
    if (dupJobTitle) extraJobTitles.add(dupJobTitle)
    absorbedSummary.push({
      id: dupId,
      name: str(dup.full_name),
      company: dupCompany,
      jobTitle: dupJobTitle,
    })

    // ── Téléphones : renumérotation sans doublon, un seul principal ──
    const { data: dupPhonesRaw } = await db.from('contact_phones')
      .select('id, normalized_phone').eq('organization_id', org).eq('contact_id', dupId)
    for (const p of ((dupPhonesRaw ?? []) as unknown as PhoneRow[])) {
      const norm = str(p.normalized_phone)
      if (norm && phoneSet.has(norm)) {
        // numéro déjà présent sur le conservé : on retire la ligne redondante
        await db.from('contact_phones').delete().eq('organization_id', org).eq('id', str(p.id))
        continue
      }
      const makePrimary = !hasPrimaryPhone
      await db.from('contact_phones').update({ contact_id: keeperId, is_primary: makePrimary })
        .eq('organization_id', org).eq('id', str(p.id))
      if (makePrimary) hasPrimaryPhone = true
      if (norm) phoneSet.add(norm)
    }

    // ── Emails : idem ──
    const { data: dupEmailsRaw } = await db.from('contact_emails')
      .select('id, email').eq('organization_id', org).eq('contact_id', dupId)
    for (const e of ((dupEmailsRaw ?? []) as unknown as EmailRow[])) {
      const mail = str(e.email).toLowerCase()
      if (mail && emailSet.has(mail)) {
        await db.from('contact_emails').delete().eq('organization_id', org).eq('id', str(e.id))
        continue
      }
      const makePrimary = !hasPrimaryEmail
      await db.from('contact_emails').update({ contact_id: keeperId, is_primary: makePrimary })
        .eq('organization_id', org).eq('id', str(e.id))
      if (makePrimary) hasPrimaryEmail = true
      if (mail) emailSet.add(mail)
    }

    // ── Tags (groupes) : conservés, sans violer la contrainte unique ──
    const { data: dupTagsRaw } = await db.from('contact_tags')
      .select('tag_id').eq('organization_id', org).eq('contact_id', dupId)
    for (const t of ((dupTagsRaw ?? []) as unknown as TagRow[])) {
      const tagId = str(t.tag_id)
      if (!tagSet.has(tagId)) {
        await db.from('contact_tags').insert({ organization_id: org, contact_id: keeperId, tag_id: tagId })
        tagSet.add(tagId)
      }
    }
    await db.from('contact_tags').delete().eq('organization_id', org).eq('contact_id', dupId)

    // ── Historique : rattaché à la fiche finale ──
    await db.from('contact_changes').update({ contact_id: keeperId }).eq('organization_id', org).eq('contact_id', dupId)

    // ── Marquage + journal ──
    await db.from('contacts')
      .update({ merged_into: keeperId, updated_at: new Date().toISOString() })
      .eq('organization_id', org).eq('id', dupId)
    await db.from('merge_logs').insert({
      organization_id: org,
      keeper_id: keeperId,
      merged_id: dupId,
      kept_values: keptValues,
      discarded_values: {
        fullName: dup.full_name ?? null, company: dup.company ?? null,
        jobTitle: dup.job_title ?? null, source: dup.source ?? null,
      },
      merged_by: ctx.userId,
    })
  }

  // Si le conservé n'avait pas d'entreprise, on récupère la première rencontrée.
  const companies = [...extraCompanies]
  if (!keeperCompany && companies.length > 0) {
    await db.from('contacts').update({ company: companies[0] }).eq('organization_id', org).eq('id', keeperId)
  }

  // Trace lisible sur la fiche : entreprises et fonctions absorbées.
  if (companies.length > 0 || extraJobTitles.size > 0) {
    await db.from('contact_changes').insert({
      organization_id: org,
      contact_id: keeperId,
      fields: {
        fusion_entreprises: companies.join(', '),
        fusion_fonctions: [...extraJobTitles].join(', '),
        fusion_fiches: absorbedSummary.map(a => a.name || a.company || a.id).join(', '),
      },
    })
  }

  await logActivity(org, ctx.userId, 'duplicates.merged', 'contact', keeperId, {
    merged: body.mergedIds,
    keptCompanies: companies,
    absorbed: absorbedSummary,
  })

  return NextResponse.json({ ok: true, merged: body.mergedIds.length, companies })
}
