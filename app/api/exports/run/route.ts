import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { loadRelations } from '@/lib/supabase/data'
import { selectAllRows } from '@/lib/supabase/pagination'
import { countryLabel } from '@/lib/supabase/page-data'
import { validateSegmentRules, loadEnrichedContacts, applySegmentGroups } from '@/lib/supabase/segment-engine'
import { logActivity } from '@/lib/supabase/data'

const bodySchema = z.object({
  scope: z.enum(['all', 'segment', 'countries']),
  segmentId: z.string().uuid().optional(),
  countries: z.array(z.string().length(2)).max(60).optional(),
  splitByCountry: z.boolean().optional(),
  onlyUnique: z.boolean().default(true),
  columns: z.array(z.enum([
    'full_name', 'first_name', 'last_name', 'phone', 'email', 'country',
    'region', 'city', 'company', 'job_title', 'source', 'tags', 'notes', 'created_at',
  ])).min(1).max(20),
})

const HEADERS_BY_COL: Record<string, string> = {
  full_name: 'Nom complet', first_name: 'Prénom', last_name: 'Nom',
  phone: 'Téléphone', email: 'Email', country: 'Pays', region: 'Région',
  city: 'Ville', company: 'Entreprise', job_title: 'Fonction', source: 'Source',
  tags: 'Tags', notes: 'Notes', created_at: "Date d'ajout",
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (ctx.role === 'viewer') return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const db = serviceDb()!
  const org = ctx.orgId

  // ── sélection des contacts ────────────────────────────────────────────────
  const rows: { id: string; data: Record<string, unknown> }[] = []
  if (body.scope === 'segment' && body.segmentId) {
    const { data: seg } = await db.from('segments').select('rules')
      .eq('organization_id', org).eq('id', body.segmentId).maybeSingle()
    if (!seg) return NextResponse.json({ error: 'Segment introuvable' }, { status: 404 })
    const validated = validateSegmentRules((seg as { rules: unknown }).rules)
    if (!validated.ok || !validated.groups) {
      return NextResponse.json({ error: validated.error ?? 'Segment invalide' }, { status: 400 })
    }
    const enriched = await loadEnrichedContacts(org)
    const ids = [...new Set(applySegmentGroups(validated.groups, enriched))]
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data } = await db.from('contacts').select('*').eq('organization_id', org).in('id', chunk)
      rows.push(...(data ?? []).map((d: Record<string, unknown>) => ({ id: String(d.id), data: d })))
    }
  } else {
    // base entière ou sélection par pays : pays effectif = country_iso2 sinon indicatif du tél. principal
    const [contacts, primaryPhones] = await Promise.all([
      selectAllRows<Record<string, unknown>>((from, to) =>
        db.from('contacts').select('*').eq('organization_id', org).is('merged_into', null)
          .order('id', { ascending: true }).range(from, to)),
      selectAllRows<{ contact_id: string; country_code: string | null }>((from, to) =>
        db.from('contact_phones').select('contact_id, country_code')
          .eq('organization_id', org).eq('is_primary', true)
          .order('id', { ascending: true }).range(from, to)),
    ])
    const phoneCountry = new Map<string, string>()
    for (const p of primaryPhones) {
      const iso = (p.country_code ?? '').toUpperCase()
      if (iso && !phoneCountry.has(p.contact_id)) phoneCountry.set(p.contact_id, iso)
    }
    const wanted = body.scope === 'countries' && body.countries?.length
      ? new Set(body.countries.map(c => c.toUpperCase()))
      : null
    for (const c of contacts) {
      const id = String(c.id)
      const iso2 = String(c.country_iso2 ?? '').toUpperCase() || phoneCountry.get(id) || ''
      if (wanted && !wanted.has(iso2)) continue
      rows.push({ id, data: { ...c, __iso2: iso2 } })
    }
  }

  // ── relations (phones / emails / tags) ───────────────────────────────────
  const rel = await loadRelations(org, rows.map(r => r.id))

  const flat = rows.map(({ id, data: r }) => {
    const phones = rel.phonesById.get(id) ?? []
    const primary = phones.find(p => p.isPrimary) ?? phones[0]
    const emails = rel.emailsById.get(id) ?? []
    const primaryEmail = emails.find(e => e.isPrimary) ?? emails[0]
    const tags = (rel.tagsById.get(id) ?? []).map(t => t.name)
    const iso2 = String(r.__iso2 ?? r.country_iso2 ?? '').toUpperCase()
    return {
      full_name: String(r.full_name ?? '') || [String(r.first_name ?? ''), String(r.last_name ?? '')].filter(Boolean).join(' '),
      first_name: String(r.first_name ?? ''),
      last_name: String(r.last_name ?? ''),
      phone: primary ? (primary.isValid ? (primary.e164 ?? primary.normalizedPhone ?? '') : primary.rawPhone) : '',
      email: primaryEmail?.email ?? '',
      country: String(r.country_name ?? '') || countryLabel(iso2 || null),
      region: String(r.region ?? ''),
      city: String(r.city ?? ''),
      company: String(r.company ?? ''),
      job_title: String(r.job_title ?? ''),
      source: String(r.source ?? ''),
      tags: tags.join(', '),
      notes: String(r.notes ?? ''),
      created_at: String(r.created_at ?? '').slice(0, 10),
      __iso2: iso2,
    }
  })

  // ── découpe par pays ─────────────────────────────────────────────────────
  const groups: { iso2: string | null; rows: typeof flat }[] =
    body.splitByCountry
      ? [...flat.reduce<Map<string, typeof flat>>((acc, r) => {
          const k = r.__iso2 || 'ZZ' // ZZ = pays inconnu
          const list = acc.get(k) ?? []
          list.push(r)
          acc.set(k, list)
          return acc
        }, new Map<string, typeof flat>()).entries()].map(([iso2, rs]) => ({ iso2, rows: rs }))
      : [{ iso2: null, rows: flat }]

  const files: { name: string; content: string }[] = []
  const headers = body.columns.map(c => HEADERS_BY_COL[c])
  for (const g of groups) {
    const lines = [headers.join(',')]
    for (const r of g.rows) {
      lines.push(body.columns.map(c => csvEscape(r[c])).join(','))
    }
    const name = g.iso2
      ? `contacts_${g.iso2.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
      : `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`
    files.push({ name, content: '\uFEFF' + lines.join('\n') })
  }

  // historique export + activité
  const { data: exp } = await db.from('export_runs').insert({
    organization_id: org,
    created_by: ctx.userId,
    scope: body.scope,
    scope_desc: body.scope === 'segment' ? body.segmentId ?? '' : body.scope === 'countries' ? (body.countries ?? []).join(',') : '',
    country_iso2s: body.scope === 'countries' ? body.countries ?? [] : [],
    columns: body.columns,
    status: 'done',
    row_count: flat.length,
  }).select('id').single()

  await logActivity(org, ctx.userId, 'export.generated', 'export', exp?.id ?? null, {
    scope: body.scope, rows: flat.length, files: files.map(f => f.name),
  })

  return NextResponse.json({ files, totalRows: flat.length, exportId: exp?.id ?? null })
}
