import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite, type OrgCtx } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'
import { parsePhoneSmart, type CountryCode } from '@/lib/contacts/fix-country-code'
import { countryIsoFromName } from '@/lib/supabase/page-data'
import { quotaForPlan } from '@/lib/plans'
import { IMPORT_CHUNK_ROWS, MAX_IMPORT_ROWS } from '@/lib/imports/limits'

type Db = NonNullable<ReturnType<typeof serviceDb>>

/**
 * Import CSV en trois temps (le wizard reste le seul client) :
 *
 *   create  → crée la ligne `import_batches` et renvoie son identifiant ;
 *   chunk   → insère un lot de IMPORT_CHUNK_ROWS lignes rattachées à cet id ;
 *   finish  → clôture l'import (done / partial) et journalise.
 *
 * Les règles de doublons choisies à l'étape 3 du wizard (detection par
 * numéro/email, butoir « ignorer » ou « importer quand même ») sont stockées
 * sur la ligne d'import et relues à chaque lot.
 *
 * Chaque lot est autonome et s'ajoute aux compteurs de la ligne d'import :
 * si un envoi échoue au milieu, les lots déjà traités restent en base et le
 * rapport reflète exactement ce qui a été inséré.
 *
 * Un corps de requête unique ne passerait pas : la plateforme rejette les
 * requêtes au-delà d'environ 4,5 Mo (413) bien avant l'exécution du code.
 */
export const maxDuration = 60

const mappingSchema = z.record(z.string(), z.string())
const dupRulesSchema = z.object({
  keyPhone: z.boolean().default(true),
  keyEmail: z.boolean().default(true),
  /**
   * Butoir de doublon : « skip » ignore la ligne déjà présente ; « duplicate »
   * l'insère quand même — les fiches en double apparaissent alors au centre
   * Doublons pour être fusionnées (cas du réimport d'un fichier existant).
   */
  onDuplicate: z.enum(['skip', 'duplicate']).default('skip'),
})
type DupRules = z.infer<typeof dupRulesSchema>

const createSchema = z.object({
  action: z.literal('create'),
  fileName: z.string().min(1).max(240),
  source: z.string().max(120).optional(),
  mapping: mappingSchema,
  dupRules: dupRulesSchema,
  totalRows: z.number().int().min(1).max(MAX_IMPORT_ROWS),
})

const chunkSchema = z.object({
  action: z.literal('chunk'),
  importId: z.string().uuid(),
  offset: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  rows: z.array(z.record(z.string(), z.unknown())).max(IMPORT_CHUNK_ROWS),
})

const finishSchema = z.object({
  action: z.literal('finish'),
  importId: z.string().uuid(),
  /** Le client signale un envoi interrompu : on clôture en « partial ». */
  failed: z.boolean().optional(),
})

const requestSchema = z.discriminatedUnion('action', [createSchema, chunkSchema, finishSchema])
type ImportRequest = z.infer<typeof requestSchema>

export type RowReport = {
  inserted: number
  updated: number
  skipped: number
  invalidPhone: number
  invalidEmail: number
  /** Numéros invalides réparés automatiquement (préfixes pays, scans). */
  repaired: number
  errors: { row: number; reason: string }[]
}

function emptyReport(): RowReport {
  return { inserted: 0, updated: 0, skipped: 0, invalidPhone: 0, invalidEmail: 0, repaired: 0, errors: [] }
}

/** Message d'erreur honnête quand le corps de la requête est refusé. */
function describeBodyError(e: unknown): string {
  if (e instanceof z.ZodError) {
    const overLimit = e.issues.some(i => i.path.includes('totalRows') || i.path.includes('rows') || i.path.includes('offset'))
    if (overLimit) {
      return `Plafond dépassé : ${MAX_IMPORT_ROWS.toLocaleString('fr-FR')} lignes maximum par import, ${IMPORT_CHUNK_ROWS.toLocaleString('fr-FR')} lignes par lot.`
    }
    return "Requête d'import invalide."
  }
  return 'Corps de requête illisible.'
}

function getBy(target: string | undefined, row: Record<string, unknown>): string {
  return target ? String(row[target] ?? '').replace(/\s+/g, ' ').trim() : ''
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type BatchRow = {
  id: string
  status: string
  source: string | null
  mapping: unknown
  duplicate_rules: unknown
  total_rows: number
  new_contacts: number
  duplicates_skipped: number
  invalid_phones: number
  invalid_emails: number
  errors_count: number
}

/** Charge la ligne d'import en vérifiant qu'elle appartient à l'organisation. */
async function loadBatch(db: Db, orgId: string, importId: string): Promise<BatchRow | null> {
  const { data } = await db.from('import_batches')
    .select('*')
    .eq('id', importId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return (data ?? null) as BatchRow | null
}

/**
 * Valeurs interrogées par requête : garde l'URL sous quelques Ko, donc le
 * nombre de requêtes par lot est prévisible : ceil(valeurs / 100) par clé activée.
 */
const LOOKUP_VALUES_PER_QUERY = 100

/**
 * Vérification ciblée en base : au lieu de recharger une fenêtre de valeurs
 * (tronquée au-delà de 10 000), on interroge exactement les numéros/emails
 * primaires présents dans le lot, par paquets bornés. La recherche porte donc
 * sur des valeurs précises : un doublon ancien en base ou très éloigné dans le
 * fichier est trouvé quelle que soit la taille de la table.
 */
async function lookupExisting(
  db: Db,
  orgId: string,
  keys: { phones: string[]; emails: string[] },
) {
  const phones = new Set<string>()
  const emails = new Set<string>()

  type PhoneRow = { normalized_phone: string | null }
  type EmailRow = { email: string | null }

  for (let i = 0; i < keys.phones.length; i += LOOKUP_VALUES_PER_QUERY) {
    const { data } = await db.from('contact_phones').select('normalized_phone')
      .eq('organization_id', orgId)
      .in('normalized_phone', keys.phones.slice(i, i + LOOKUP_VALUES_PER_QUERY))
    for (const r of ((data ?? []) as unknown as PhoneRow[])) {
      if (r.normalized_phone) phones.add(r.normalized_phone)
    }
  }

  for (let i = 0; i < keys.emails.length; i += LOOKUP_VALUES_PER_QUERY) {
    const { data } = await db.from('contact_emails').select('email')
      .eq('organization_id', orgId)
      .in('email', keys.emails.slice(i, i + LOOKUP_VALUES_PER_QUERY))
    for (const r of ((data ?? []) as unknown as EmailRow[])) {
      if (r.email) emails.add(r.email.toLowerCase())
    }
  }

  return { phones, emails }
}

type ChunkInput = {
  rows: Record<string, unknown>[]
  /** Index de la première ligne du lot dans le fichier (pour les numéros de ligne du rapport). */
  offset: number
  mapping: Record<string, string>
  dupRules: DupRules
  source?: string
}

/** Une ligne du lot, enrichie (normalisée) puis filtrée avant insertion. */
type PreparedRow = {
  rowNum: number
  row: Record<string, unknown>
  phones: { raw: string; normalized: string | null; e164: string | null; cc: string | null; valid: boolean }[]
  emails: { raw: string; valid: boolean }[]
  primaryPhone: string | null
  primaryEmail: string | null
}
/**
 * Importe un lot en trois temps :
 *  1. enrichissement — normalisation de chaque ligne, aucune requête ;
 *  2. vérification ciblée — seuls les numéros/emails primaires réellement
 *     présents dans le lot sont interrogés en base, par paquets bornés ;
 *  3. décision + insertion — doublon en base ou doublon du même fichier, puis
 *     écriture par paquets de 200.
 * `seen` ne retient que les valeurs acceptées pendant ce lot : c'est le suivi
 * des doublons intra-fichier, complémentaire de la recherche en base.
 */
async function insertChunk(
  db: Db,
  ctx: OrgCtx,
  importId: string,
  input: ChunkInput,
): Promise<RowReport> {
  const org = ctx.orgId
  const { rows, offset, mapping, dupRules } = input
  const report = emptyReport()

  // 1. enrichissement — normalisation de chaque ligne (aucun accès base)

  // Pays de contexte par ligne : la colonne « Pays » du fichier (nom français,
  // anglais ou code ISO) sert d'indice aux numéros locaux sans « + ».
  const rowHint = rows.map(row => countryIsoFromName(getBy(mapping.country, row)))
  // Indice de repli : pays dominant du lot (fichiers sans colonne pays)
  const isoCount = new Map<string, number>()
  for (const iso of rowHint) {
    if (!iso) continue
    isoCount.set(iso, (isoCount.get(iso) ?? 0) + 1)
  }
  let dominantIso: string | null = null
  let dominantMax = 0
  for (const [iso, n] of isoCount) {
    if (n > dominantMax) {
      dominantMax = n
      dominantIso = iso
    }
  }

  const prepared: PreparedRow[] = []
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    const rowNum = offset + idx + 2 // +2 : en-tête CSV + index 0
    const first = getBy(mapping.first_name, row)
    const last = getBy(mapping.last_name, row)
    const fullName = getBy(mapping.full_name, row) || [first, last].filter(Boolean).join(' ').trim()
    const rawPhone = getBy(mapping.phone, row)
    const rawEmail = getBy(mapping.email, row)
    if (!fullName && !rawPhone && !rawEmail) {
      report.errors.push({ row: rowNum, reason: 'Ligne vide ou sans identifiant' })
      continue
    }

    const hint = rowHint[idx] ?? dominantIso
    const countryName = getBy(mapping.country, row) || null

    const phones: PreparedRow['phones'] = []
    if (rawPhone) {
      for (const piece of rawPhone.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean)) {
        const parsed = parsePhoneSmart(piece, hint as CountryCode | undefined ?? undefined)
        if (!parsed.cc && !parsed.normalized) {
          // totalement imparsable : compté invalide mais conservé brut
          report.invalidPhone++
          phones.push({ raw: parsed.raw, normalized: null, e164: null, cc: null, valid: false })
          continue
        }
        if (parsed.repaired) report.repaired++
        else if (!parsed.valid && parsed.cc) report.invalidPhone++
        phones.push({ raw: parsed.raw, normalized: parsed.normalized, e164: parsed.e164, cc: parsed.iso2, valid: parsed.valid })
      }
    }
    const emails: PreparedRow['emails'] = []
    if (rawEmail) {
      for (const e of rawEmail.split(/[;,/|]+/).map(s => s.trim().toLowerCase()).filter(Boolean)) {
        const ok = EMAIL_RE.test(e)
        emails.push({ raw: e, valid: ok })
        if (!ok) report.invalidEmail++
      }
    }

    prepared.push({
      rowNum,
      row: {
        organization_id: org,
        first_name: first || null,
        last_name: last || null,
        full_name: fullName || null,
        company: getBy(mapping.company, row) || null,
        job_title: getBy(mapping.job_title, row) || null,
        source: getBy(mapping.source, row) || (input.source || null),
        country_iso2: hint || null,
        country_name: countryName,
        city: getBy(mapping.city, row) || null,
        region: getBy(mapping.region, row) || null,
        import_id: importId,
        merged_into: null,
      },
      phones,
      emails,
      primaryPhone: phones[0]?.normalized ?? null,
      primaryEmail: emails[0]?.raw ?? null,
    })
  }

  // 2. vérification ciblée : uniquement les valeurs de ce lot, par paquets bornés
  // (mode « duplicate » : inutile d'interroger la base, tout est inséré)
  const checkDb = dupRules.onDuplicate === 'skip'
  const keys = {
    phones: checkDb && dupRules.keyPhone
      ? [...new Set(prepared.map(r => r.primaryPhone).filter((v): v is string => Boolean(v)))]
      : [],
    emails: checkDb && dupRules.keyEmail
      ? [...new Set(prepared.map(r => r.primaryEmail).filter((v): v is string => Boolean(v)))]
      : [],
  }
  const inDb = await lookupExisting(db, org, keys)

  // 3. décision de doublon (base + intra-fichier) puis insertion
  const seen = { phones: new Set<string>(), emails: new Set<string>() }
  const contactsToInsert: PreparedRow[] = []
  for (const p of prepared) {
    if (checkDb && dupRules.keyPhone && p.primaryPhone && (inDb.phones.has(p.primaryPhone) || seen.phones.has(p.primaryPhone))) {
      report.skipped++
      continue
    }
    if (checkDb && dupRules.keyEmail && p.primaryEmail && (inDb.emails.has(p.primaryEmail) || seen.emails.has(p.primaryEmail))) {
      report.skipped++
      continue
    }
    // mémorise toutes les valeurs acceptées : un doublon du même lot est repéré
    // même lorsqu'il porte sur un numéro secondaire
    p.phones.forEach(ph => { if (ph.normalized) seen.phones.add(ph.normalized) })
    p.emails.forEach(em => seen.emails.add(em.raw))
    contactsToInsert.push(p)
  }

  // insertions en lot (contacts puis sous-entités)
  const BATCH = 200
  for (let i = 0; i < contactsToInsert.length; i += BATCH) {
    const part = contactsToInsert.slice(i, i + BATCH)
    const { data: inserted, error } = await db.from('contacts').insert(part.map(c => c.row)).select('id')
    if (error) {
      report.errors.push({ row: part[0].rowNum, reason: 'Lot SQL impossible' })
      continue
    }
    report.inserted += inserted?.length ?? 0

    const phoneIns: Record<string, unknown>[] = []
    const emailIns: Record<string, unknown>[] = []
    type InsRow = { id: string }
    const insertedRows = ((inserted ?? []) as unknown) as InsRow[]
    insertedRows.forEach((c, idx) => {
      const spec = part[idx]
      spec.phones.forEach((ph, pi) => {
        phoneIns.push({
          organization_id: org, contact_id: c.id, raw_phone: ph.raw,
          normalized_phone: ph.normalized, e164: ph.e164, country_code: ph.cc,
          is_valid: ph.valid, is_primary: pi === 0,
        })
      })
      spec.emails.forEach((em, ei) => {
        emailIns.push({ organization_id: org, contact_id: c.id, email: em.raw, is_valid: em.valid, is_primary: ei === 0 })
      })
    })
    if (phoneIns.length > 0) await db.from('contact_phones').insert(phoneIns)
    if (emailIns.length > 0) await db.from('contact_emails').insert(emailIns)
  }

  return report
}

/** create : quota + création de la ligne d'import. */
async function createImport(db: Db, ctx: OrgCtx, body: z.infer<typeof createSchema>) {
  // Garde de quota : le plan limite le volume de contacts de l'organisation
  const { count: currentCount } = await db.from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
  const quota = Math.max(ctx.quota, quotaForPlan(ctx.orgPlan))
  if ((currentCount ?? 0) >= quota) {
    return NextResponse.json({ error: 'QUOTA_REACHED', quota, plan: ctx.orgPlan }, { status: 402 })
  }

  const { data: imp, error: impErr } = await db.from('import_batches').insert({
    organization_id: ctx.orgId,
    created_by: ctx.userId,
    file_name: body.fileName,
    status: 'processing',
    source: body.source || null,
    mapping: body.mapping,
    duplicate_rules: body.dupRules,
    total_rows: body.totalRows,
  }).select('id').single()
  if (impErr || !imp) {
    return NextResponse.json({ error: impErr?.message ?? 'Création impossible' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, importId: imp.id })
}

/** chunk : insertion d'un lot + cumul des compteurs du rapport. */
async function appendChunk(db: Db, ctx: OrgCtx, body: z.infer<typeof chunkSchema>) {
  const batch = await loadBatch(db, ctx.orgId, body.importId)
  if (!batch) return NextResponse.json({ error: 'Import introuvable.' }, { status: 404 })
  if (batch.status !== 'processing') {
    return NextResponse.json({ error: `Cet import est déjà clôturé (${batch.status}).` }, { status: 409 })
  }
  if (body.offset + body.rows.length > batch.total_rows) {
    return NextResponse.json(
      { error: `Les lignes reçues dépassent le total déclaré (${batch.total_rows} lignes).` },
      { status: 400 },
    )
  }

  const report = await insertChunk(db, ctx, batch.id, {
    rows: body.rows,
    offset: body.offset,
    mapping: (batch.mapping ?? {}) as Record<string, string>,
    dupRules: {
      keyPhone: Boolean((batch.duplicate_rules as { keyPhone?: boolean } | null)?.keyPhone),
      keyEmail: Boolean((batch.duplicate_rules as { keyEmail?: boolean } | null)?.keyEmail),
      onDuplicate: (batch.duplicate_rules as { onDuplicate?: 'skip' | 'duplicate' } | null)?.onDuplicate === 'duplicate'
        ? 'duplicate' as const
        : 'skip' as const,
    },
    source: (batch.source as string | null) ?? undefined,
  })

  const { error: updErr } = await db.from('import_batches').update({
    new_contacts: batch.new_contacts + report.inserted,
    duplicates_skipped: batch.duplicates_skipped + report.skipped,
    invalid_phones: batch.invalid_phones + report.invalidPhone,
    invalid_emails: batch.invalid_emails + report.invalidEmail,
    errors_count: batch.errors_count + report.errors.length,
  }).eq('id', batch.id).eq('organization_id', ctx.orgId)

  if (updErr) return NextResponse.json({ ok: true, report, warning: 'Rapport incomplet' })
  return NextResponse.json({ ok: true, report })
}

/** finish : clôture (done / partial) + journalisation + totaux cumulés. */
async function finishImport(db: Db, ctx: OrgCtx, body: z.infer<typeof finishSchema>) {
  const batch = await loadBatch(db, ctx.orgId, body.importId)
  if (!batch) return NextResponse.json({ error: 'Import introuvable.' }, { status: 404 })

  let status = batch.status
  if (batch.status === 'processing') {
    status = body.failed ? 'partial' : 'done'
    await db.from('import_batches').update({ status })
      .eq('id', batch.id).eq('organization_id', ctx.orgId)
    await logActivity(ctx.orgId, ctx.userId, body.failed ? 'import.partial' : 'import.done', 'import', batch.id, {
      file: batch.id, status, inserted: batch.new_contacts, skipped: batch.duplicates_skipped,
    })
  }

  return NextResponse.json({
    ok: true,
    importId: batch.id,
    status,
    totals: {
      inserted: batch.new_contacts,
      skipped: batch.duplicates_skipped,
      invalidPhone: batch.invalid_phones,
      invalidEmail: batch.invalid_emails,
      errors: batch.errors_count,
    },
  })
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })

  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: ImportRequest
  try {
    body = requestSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ error: describeBodyError(e) }, { status: 400 })
  }

  if (body.action === 'create') return createImport(db, ctx, body)
  if (body.action === 'chunk') return appendChunk(db, ctx, body)
  return finishImport(db, ctx, body)
}
