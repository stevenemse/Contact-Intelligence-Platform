import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { loadRelations } from '@/lib/supabase/data'
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
  let rows: { id: string; data: Record<string, unknown> }[] = []
  if (body.scope === 'segment' && body.segmentId) {
    const { data: seg } = await db.from('segments').select('rules')
      .eq('organization_id', org).eq('id', body.segmentId).maybeSingle()
    if (!seg) return NextResponse.json({ error: 'Segment introuvable' }, { status: 404 })
    const validated = validateSegmentRules((seg as { rules: unknown }).rules)
    if (!validated.ok || !validated.groups) {
      return NextResponse.json({ error: validated.error ?? 'Segment invalide' }, { status: 400 })
    }
    const enriched = await loadEnrichedContacts(org)
    const ids = new Set(applySegmentGroups(validated.groups, enriched))
    { // fetch des lignes complètes pour ces ids
      const list = [...ids.values()].slice(0, 10000)
      for (let i = 0; i < list.length; i += 200) {
        const chunk = list.slice(i, i + 200)
        const { data } = await db.from('contacts').select('*').eq('organization_id', org).in('id', chunk)
        rows.push(...(data ?? []).map((d: Record<string, unknown>) => ({ id: String(d.id), data: d })))
      }
    }
  } else if (body.scope === 'countries' && body.countries?.length) {
    const sel = body.countries.map(c => c.toUpperCase())
    const { data } = await db.from('contacts').select('*')
      .eq('organization_id', org).is('merged_into', null).in('country_iso2', sel).limit(10000)
    rows = (data ?? []).map((d: Record<string, unknown>) => ({ id: String(d.id), data: d }))
  } else {
    const { data } = await db.from('contacts').select('*')
      .eq('organization_id', org).is('merged_into', null).limit(10000)
    rows = (data ?? []).map((d: Record<string, unknown>) => ({ id: String(d.id), data: d }))
  }

  // ── relations (phones / emails / tags) ───────────────────────────────────
  const rel = await loadRelations(org, rows.map(r => r.id))
  const emailsExtra = await db.from('contact_emails').select('contact_id, email, is_primary')
    .eq('organization_id', org)
    .in('contact_id', rows.length > 0 ? rows.map(r => r.id) : ['00000000-0000-0000-0000-000000000000'])
    .limit(30000)
  const emailsByContact2 = new Map<string, ReturnType<typeof getEmails>[]>()
  const getEmails = (email: string, isPrimary: boolean) => ({ email, isPrimary })
  for (const e of (emailsExtra.data ?? []) as { contact_id: string; email: string | null; is_primary: boolean | null }[]) {
    const list = emailsByContact2.get(e.contact_id) ?? []
    list.push(getEmails(e.email ?? '', Boolean(e.is_primary)))
    emailsByContact2.set(e.contact_id, list)
  }

  const flat = rows.map(({ id, data: r }) => {
    const phones = rel.phonesById.get(id) ?? []
    const primary = phones.find(p => p.isPrimary) ?? phones[0]
    const emails = emailsByContact2.get(id) ?? []
    const primaryEmail = emails.find(e => e.isPrimary) ?? emails[0]
    const tags = (rel.tagsById.get(id) ?? []).map(t => t.name)
    return {
      full_name: String(r.full_name ?? '') || [String(r.first_name ?? ''), String(r.last_name ?? '')].filter(Boolean).join(' '),
      first_name: String(r.first_name ?? ''),
      last_name: String(r.last_name ?? ''),
      phone: primary ? (primary.isValid ? (primary.e164 ?? primary.normalizedPhone ?? '') : primary.rawPhone) : '',
      email: primaryEmail?.email ?? '',
      country: String(r.country_name ?? ''),
      region: String(r.region ?? ''),
      city: String(r.city ?? ''),
      company: String(r.company ?? ''),
      job_title: String(r.job_title ?? ''),
      source: String(r.source ?? ''),
      tags: tags.join(', '),
      notes: String(r.notes ?? ''),
      created_at: String(r.created_at ?? '').slice(0, 10),
      __iso2: String(r.country_iso2 ?? '').toUpperCase(),
    }
  })

  // ── découpe par pays ─────────────────────────────────────────────────────
  const groups: { iso2: string | null; rows: typeof flat }[] =
    body.splitByCountry
      ? [...flat.reduce<Map<string, typeof flat>>((acc, r) => {
          const k = r.__iso2 ?? 'ZZ'
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
