import { NextResponse, type NextRequest } from 'next/server'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const mappingSchema = z.record(z.string(), z.string())
const bodySchema = z.object({
  fileName: z.string().min(1).max(240),
  source: z.string().max(120).optional(),
  mapping: mappingSchema,
  dupRules: z.object({ keyPhone: z.boolean().default(true), keyEmail: z.boolean().default(true) }),
  rows: z.array(z.record(z.string(), z.unknown())).max(20000),
})

function getBy(target: string | undefined, row: Record<string, unknown>): string {
  return target ? String(row[target] ?? '').replace(/\s+/g, ' ').trim() : ''
}

function normalizePhone(raw: string) {
  const parsed = parsePhoneNumberFromString(raw)
  if (!parsed) return null
  return {
    raw,
    normalized: parsed.formatInternational(),
    e164: parsed.format('E.164'),
    cc: parsed.country ?? null,
    valid: parsed.isValid(),
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Import invalide (trop de lignes ? max 20 000)' }, { status: 400 })
  }

  const db = serviceDb()!
  const org = ctx.orgId
  const mapping = body.mapping

  // création de la ligne import
  const { data: imp, error: impErr } = await db.from('import_batches').insert({
    organization_id: org,
    created_by: ctx.userId,
    file_name: body.fileName,
    status: 'processing',
    source: body.source || null,
    mapping,
    duplicate_rules: body.dupRules,
    total_rows: body.rows.length,
  }).select('id').single()
  if (impErr || !imp) return NextResponse.json({ error: impErr?.message ?? 'Création impossible' }, { status: 500 })
  const importId = imp.id

  // numéros/emails existants (2 requêtes, ~10k) pour le dédoublonnage
  const [existingPhones, existingEmails] = await Promise.all([
    db.from('contact_phones').select('normalized_phone').eq('organization_id', org).not('normalized_phone', 'is', null).limit(10000),
    db.from('contact_emails').select('email').eq('organization_id', org).limit(10000),
  ])
  type PhoneRow = { normalized_phone: string | null }
  type EmailRow = { email: string | null }
  const seenPhones = new Set(
    ((existingPhones.data ?? []) as unknown as PhoneRow[]).map(p => p.normalized_phone ?? '')
  )
  const seenEmails = new Set(
    ((existingEmails.data ?? []) as unknown as EmailRow[]).map(e => (e.email ?? '').toLowerCase())
  )

  const report = { inserted: 0, updated: 0, skipped: 0, invalidPhone: 0, invalidEmail: 0, errors: [] as { row: number; reason: string }[] }
  const BATCH = 200

  for (let i = 0; i < body.rows.length; i += BATCH) {
    const batch = body.rows.slice(i, i + BATCH)
    type ContactIns = Record<string, unknown>
    const contactsToInsert: { row: ContactIns; phones: { raw: string; normalized: string | null; e164: string | null; cc: string | null; valid: boolean }[]; emails: { raw: string; valid: boolean }[] }[] = []

    for (let bi = 0; bi < batch.length; bi++) {
      const row = batch[bi]
      const rowNum = i + bi + 2
      const first = getBy(mapping.first_name, row)
      const last = getBy(mapping.last_name, row)
      const fullName = getBy(mapping.full_name, row) || [first, last].filter(Boolean).join(' ').trim()
      const rawPhone = getBy(mapping.phone, row)
      const rawEmail = getBy(mapping.email, row)
      if (!fullName && !rawPhone && !rawEmail) {
        report.errors.push({ row: rowNum, reason: 'Ligne vide ou sans identifiant' })
        continue
      }

      const phones: { raw: string; normalized: string | null; e164: string | null; cc: string | null; valid: boolean }[] = []
      if (rawPhone) {
        for (const piece of rawPhone.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean)) {
          const parsed = normalizePhone(piece)
          if (!parsed) continue
          phones.push(parsed)
          if (!parsed.valid) report.invalidPhone++
        }
      }
      const emails: { raw: string; valid: boolean }[] = []
      if (rawEmail) {
        for (const e of rawEmail.split(/[;,/|]+/).map(s => s.trim().toLowerCase()).filter(Boolean)) {
          const ok = EMAIL_RE.test(e)
          emails.push({ raw: e, valid: ok })
          if (!ok) report.invalidEmail++
        }
      }

      const primaryPhone = phones[0]?.normalized ?? null
      const primaryEmail = emails[0]?.raw ?? null
      if (body.dupRules.keyPhone && primaryPhone && seenPhones.has(primaryPhone)) { report.skipped++; continue }
      if (body.dupRules.keyEmail && primaryEmail && seenEmails.has(primaryEmail)) { report.skipped++; continue }

      contactsToInsert.push({
        row: {
          organization_id: org,
          first_name: first || null,
          last_name: last || null,
          full_name: fullName || null,
          company: getBy(mapping.company, row) || null,
          job_title: getBy(mapping.job_title, row) || null,
          source: getBy(mapping.source, row) || (body.source || null),
          country_iso2: getBy(mapping.country, row).toUpperCase().slice(0, 2) || null,
          country_name: getBy(mapping.country, row) || null,
          city: getBy(mapping.city, row) || null,
          region: getBy(mapping.region, row) || null,
          import_id: importId,
          merged_into: null,
        },
        phones,
        emails,
      })
    }

    // insertions en lot (contacts puis sous-entités)
    if (contactsToInsert.length > 0) {
      const { data: inserted, error } = await db.from('contacts').insert(contactsToInsert.map(c => c.row)).select('id')
      if (error) {
        report.errors.push({ row: i + 1, reason: `Lot SQL : ${error.message}` })
        continue
      }
      report.inserted += inserted?.length ?? 0

      const phoneIns: Record<string, unknown>[] = []
      const emailIns: Record<string, unknown>[] = []
      type InsRow = { id: string }
      const insertedRows = ((inserted ?? []) as unknown) as InsRow[]
      insertedRows.forEach((c, idx) => {
        const spec = contactsToInsert[idx]
        spec.phones.forEach((p, pi) => {
          phoneIns.push({
            organization_id: org, contact_id: c.id, raw_phone: p.raw,
            normalized_phone: p.normalized, e164: p.e164, country_code: p.cc,
            is_valid: p.valid, is_primary: pi === 0,
          })
          if (p.normalized) seenPhones.add(p.normalized)
        })
        spec.emails.forEach((e, ei) => {
          emailIns.push({ organization_id: org, contact_id: c.id, email: e.raw, is_valid: e.valid, is_primary: ei === 0 })
          seenEmails.add(e.raw)
        })
      })
      if (phoneIns.length > 0) await db.from('contact_phones').insert(phoneIns)
      if (emailIns.length > 0) await db.from('contact_emails').insert(emailIns)
    }
  }

  const { error: updErr } = await db.from('import_batches').update({
    status: 'done',
    new_contacts: report.inserted,
    duplicates_skipped: report.skipped,
    invalid_phones: report.invalidPhone,
    invalid_emails: report.invalidEmail,
    errors_count: report.errors.length,
  }).eq('id', importId)

  await logActivity(org, ctx.userId, 'import.done', 'import', importId, {
    file: body.fileName, inserted: report.inserted, skipped: report.skipped,
  })

  if (updErr) return NextResponse.json({ ok: true, importId, report, warning: 'Rapport incomplet' })
  return NextResponse.json({ ok: true, importId, report })
}
