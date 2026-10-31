import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'
import { str } from '@/lib/supabase/helpers'

// Un groupe de doublons peut compter des centaines de fiches (groupes WhatsApp
// réimportés à chaque campagne) : la limite protège contre une requête mal
// construite, pas contre une vraie fusion. Le client s'arrête bien avant.
const MAX_MERGED = 2000
const bodySchema = z.object({
  keeperId: z.string().uuid(),
  mergedIds: z.array(z.string().uuid()).min(1).max(MAX_MERGED),
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

function getClientIp(request: NextRequest): string {
  // Essayer d'obtenir l'IP depuis les headers X-Forwarded-For (proxies/Cloudflare)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim()
    if (ip) return ip
  }
  // Fallback : on utilise 'origin-based'
  return 'origin-based'
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

  // ── État des fiches absorbées, en 4 requêtes groupées quel que soit le volume ──
  const dupIds = body.mergedIds
  const [dupPhonesRes, dupEmailsRes, dupTagsRes, dupChangesRes] = await Promise.all([
    db.from('contact_phones').select('id, normalized_phone').eq('organization_id', org).in('contact_id', dupIds),
    db.from('contact_emails').select('id, email').eq('organization_id', org).in('contact_id', dupIds),
    db.from('contact_tags').select('id, tag_id').eq('organization_id', org).in('contact_id', dupIds),
    db.from('contact_changes').select('id').eq('organization_id', org).in('contact_id', dupIds),
  ])
  const dupPhones = (dupPhonesRes.data ?? []) as unknown as PhoneRow[]
  const dupEmails = (dupEmailsRes.data ?? []) as unknown as EmailRow[]
  const dupTags = (dupTagsRes.data ?? []) as unknown as (TagRow & { id: string })[]

  // entreprises / fonctions rencontrées : jamais perdues, même si la fiche absorbée disparaît des listes
  const extraCompanies = new Set<string>()
  const extraJobTitles = new Set<string>()
  for (const dup of dupes as unknown as DupRow[]) {
    const dupCompany = str(dup.company).trim()
    const dupJobTitle = str(dup.job_title).trim()
    if (dupCompany && dupCompany !== keeperCompany) extraCompanies.add(dupCompany)
    if (dupJobTitle) extraJobTitles.add(dupJobTitle)
  }

  // ── Téléphones : renumérotation sans doublon, un seul principal (« in batch ») ──
  const phoneIdsToDelete: string[] = []
  const phoneIdsMovePrimary: string[] = []
  const phoneIdsMoveSilent: string[] = []
  for (const p of dupPhones) {
    const norm = str(p.normalized_phone)
    if (norm && phoneSet.has(norm)) { phoneIdsToDelete.push(str(p.id)); continue }
    if (!hasPrimaryPhone) { phoneIdsMovePrimary.push(str(p.id)); hasPrimaryPhone = true }
    else phoneIdsMoveSilent.push(str(p.id))
    if (norm) phoneSet.add(norm)
  }
  if (phoneIdsToDelete.length) await db.from('contact_phones').delete().eq('organization_id', org).in('id', phoneIdsToDelete)
  if (phoneIdsMovePrimary.length) await db.from('contact_phones').update({ contact_id: keeperId, is_primary: true }).eq('organization_id', org).in('id', phoneIdsMovePrimary)
  if (phoneIdsMoveSilent.length) await db.from('contact_phones').update({ contact_id: keeperId, is_primary: false }).eq('organization_id', org).in('id', phoneIdsMoveSilent)

  // ── Emails : idem ──
  const emailIdsToDelete: string[] = []
  const emailIdsMovePrimary: string[] = []
  const emailIdsMoveSilent: string[] = []
  for (const e of dupEmails) {
    const mail = str(e.email).toLowerCase()
    if (mail && emailSet.has(mail)) { emailIdsToDelete.push(str(e.id)); continue }
    if (!hasPrimaryEmail) { emailIdsMovePrimary.push(str(e.id)); hasPrimaryEmail = true }
    else emailIdsMoveSilent.push(str(e.id))
    if (mail) emailSet.add(mail)
  }
  if (emailIdsToDelete.length) await db.from('contact_emails').delete().eq('organization_id', org).in('id', emailIdsToDelete)
  if (emailIdsMovePrimary.length) await db.from('contact_emails').update({ contact_id: keeperId, is_primary: true }).eq('organization_id', org).in('id', emailIdsMovePrimary)
  if (emailIdsMoveSilent.length) await db.from('contact_emails').update({ contact_id: keeperId, is_primary: false }).eq('organization_id', org).in('id', emailIdsMoveSilent)

  // ── Tags (groupes) : conservés, sans violer la contrainte unique ──
  const { data: keeperTagsRaw } = await db.from('contact_tags')
    .select('tag_id').eq('organization_id', org).eq('contact_id', keeperId)
  const tagSet = new Set(((keeperTagsRaw ?? []) as unknown as TagRow[]).map(t => str(t.tag_id)))
  const newTags = dupTags.filter(t => { const id = str(t.tag_id); if (!id || tagSet.has(id)) return false; tagSet.add(id); return true })
  if (newTags.length) {
    await db.from('contact_tags').insert(newTags.map(t => ({ organization_id: org, contact_id: keeperId, tag_id: str(t.tag_id) })))
  }
  await db.from('contact_tags').delete().eq('organization_id', org).in('contact_id', dupIds)

  // ── Historique : rattaché à la fiche finale ──
  await db.from('contact_changes').update({ contact_id: keeperId }).eq('organization_id', org).in('contact_id', dupIds)

  // ── Marquage + journal (un seul upsert en masse) ──
  await db.from('contacts')
    .update({ merged_into: keeperId, updated_at: new Date().toISOString() })
    .eq('organization_id', org).in('id', dupIds)

  // Ajout du journal de fusion avec l'IP de l'utilisateur
  const clientIp = getClientIp(req)
  await db.from('merge_logs').insert(body.mergedIds.map(dupId => ({
    organization_id: org,
    keeper_id: keeperId,
    merged_id: dupId,
    kept_values: keptValues,
    merged_by: ctx.userId,
    ip_address: clientIp,
  })))

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
      },
    })
  }

  await logActivity(org, ctx.userId, 'duplicates.merged', 'contact', keeperId, {
    merged: body.mergedIds,
    keptCompanies: companies,
  })

  return NextResponse.json({ ok: true, merged: body.mergedIds.length, companies })
}