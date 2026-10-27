import 'server-only'
import { serviceDb } from './server'
import { selectAllRows } from './pagination'

// ── Types publics (mêmes formes que la version Firestore, camelCase) ────────

export type PhoneSub = {
  id: string
  rawPhone: string
  normalizedPhone: string | null
  e164: string | null
  countryCode: string | null
  isValid: boolean
  isPrimary: boolean
}

export type EmailSub = {
  id: string
  email: string
  isValid: boolean
  isPrimary: boolean
}

export type TagRef = { id: string; name: string; color: string }

export type ContactRow = {
  id: string
  organizationId: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  company: string | null
  jobTitle: string | null
  source: string | null
  notes: string | null
  countryIso2: string | null
  countryName: string | null
  city: string | null
  region: string | null
  createdAt: string
  updatedAt: string
  mergedInto: string | null
  importId: string | null
  phones: PhoneSub[]
  emails: EmailSub[]
  tags: TagRef[]
  custom: Record<string, string | number | boolean>
}

// ── Types SQL bruts (snake_case) ────────────────────────────────────────────

type DbPhone = {
  id: string; raw_phone: string | null; normalized_phone: string | null
  e164: string | null; country_code: string | null
  is_valid: boolean | null; is_primary: boolean | null
}
type DbEmail = { id: string; email: string | null; is_valid: boolean | null; is_primary: boolean | null }
type DbTag = { id: string; name: string | null; color: string | null }

export type DbContact = {
  id: string; organization_id: string
  first_name: string | null; last_name: string | null; full_name: string | null
  company: string | null; job_title: string | null; source: string | null; notes: string | null
  country_iso2: string | null; country_name: string | null; city: string | null; region: string | null
  merged_into: string | null; import_id: string | null
  created_at: string; updated_at: string
}

export function mapPhone(p: DbPhone): PhoneSub {
  return {
    id: p.id,
    rawPhone: p.raw_phone ?? '',
    normalizedPhone: p.normalized_phone ?? null,
    e164: p.e164 ?? null,
    countryCode: p.country_code ?? null,
    isValid: Boolean(p.is_valid),
    isPrimary: Boolean(p.is_primary),
  }
}

export function mapEmail(e: DbEmail): EmailSub {
  return { id: e.id, email: e.email ?? '', isValid: Boolean(e.is_valid), isPrimary: Boolean(e.is_primary) }
}

export function mapTag(t: DbTag): TagRef {
  return { id: t.id, name: t.name ?? '', color: t.color || '#2563eb' }
}

export function mapContact(c: DbContact): ContactRow {
  return {
    id: c.id,
    organizationId: c.organization_id,
    firstName: c.first_name ?? null,
    lastName: c.last_name ?? null,
    fullName: c.full_name ?? null,
    company: c.company ?? null,
    jobTitle: c.job_title ?? null,
    source: c.source ?? null,
    notes: c.notes ?? null,
    countryIso2: c.country_iso2 ?? null,
    countryName: c.country_name ?? null,
    city: c.city ?? null,
    region: c.region ?? null,
    createdAt: c.created_at ?? '1970-01-01T00:00:00Z',
    updatedAt: c.updated_at ?? c.created_at ?? '1970-01-01T00:00:00Z',
    mergedInto: c.merged_into ?? null,
    importId: c.import_id ?? null,
    phones: [],
    emails: [],
    tags: [],
    custom: {},
  }
}

/** Chargement des relations pour des listes de contacts (phones/emails/tags). */
export async function loadRelations(
  orgId: string,
  ids: string[]
): Promise<{ phonesById: Map<string, PhoneSub[]>; emailsById: Map<string, EmailSub[]>; tagsById: Map<string, TagRef[]> }> {
  const db = serviceDb()
  const out = {
    phonesById: new Map<string, PhoneSub[]>(),
    emailsById: new Map<string, EmailSub[]>(),
    tagsById: new Map<string, TagRef[]>(),
  }
  if (!db || ids.length === 0) return out

  const CHUNK = 200 // Postgres IN sans limite pratique
  const [phones, emails, rels, tagList] = await Promise.all([
    (async () => {
      const acc: DbPhone[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data } = await db.from('contact_phones').select('*')
          .in('contact_id', ids.slice(i, i + CHUNK)).order('created_at', { ascending: true })
        if (data) acc.push(...(data as unknown as DbPhone[]))
      }
      return acc
    })(),
    (async () => {
      const acc: DbEmail[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data } = await db.from('contact_emails').select('*')
          .in('contact_id', ids.slice(i, i + CHUNK)).order('created_at', { ascending: true })
        if (data) acc.push(...(data as unknown as DbEmail[]))
      }
      return acc
    })(),
    (async () => {
      const acc: { contact_id: string; tag_id: string }[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data } = await db.from('contact_tags').select('contact_id, tag_id')
          .in('contact_id', ids.slice(i, i + CHUNK))
        if (data) acc.push(...(data as { contact_id: string; tag_id: string }[]))
      }
      return acc
    })(),
    db.from('tags').select('id, name, color').eq('organization_id', orgId),
  ])

  const tagById = new Map(
    ((tagList.data ?? []) as unknown as { id: string; name: string | null; color: string | null }[])
      .map((t: { id: string; name: string | null; color: string | null }) => [t.id, mapTag(t as unknown as DbTag)])
  )

  for (const p of phones) {
    const cid = (p as unknown as { contact_id: string }).contact_id
    const list = out.phonesById.get(cid) ?? []
    list.push(mapPhone(p))
    out.phonesById.set(cid, list)
  }
  for (const e of emails) {
    const cid = (e as unknown as { contact_id: string }).contact_id
    const list = out.emailsById.get(cid) ?? []
    list.push(mapEmail(e))
    out.emailsById.set(cid, list)
  }
  for (const r of rels) {
    const tagId = (r as unknown as { tag_id: string }).tag_id
    const tag = tagById.get(tagId)
    if (!tag) continue
    const cid = (r as unknown as { contact_id: string }).contact_id
    const list = out.tagsById.get(cid) ?? []
    list.push(tag)
    out.tagsById.set(cid, list)
  }
  return out
}

/** Compat : signatures de l'ancien `loadPhones`. */
export async function loadPhones(_db: unknown, orgId: string, ids: string[]): Promise<Map<string, PhoneSub[]>> {
  return (await loadRelations(orgId, ids)).phonesById
}
export async function loadEmails(_db: unknown, orgId: string, ids: string[]): Promise<Map<string, EmailSub[]>> {
  return (await loadRelations(orgId, ids)).emailsById
}
export async function loadTagsForContacts(orgId: string, ids: string[]): Promise<Map<string, TagRef[]>> {
  return (await loadRelations(orgId, ids)).tagsById
}

// ── Liste des contacts (recherche + filtres + tri + pagination SQL) ─────────

export type ContactListOpts = {
  q?: string
  country?: string
  source?: string
  tag?: string
  phoneValid?: string
  sort?: 'createdAt' | 'name'
  dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export type ContactEmbedded = DbContact & {
  contact_phones?: unknown[] | null
  contact_emails?: unknown[] | null
  contact_tags?: { tags: DbTag | null }[] | null
}

export function embeddedToRow(orgId: string, c: DbContact, phones: unknown[], emails: unknown[], tagRels: unknown[]): ContactRow {
  return {
    ...mapContact(c),
    phones: (phones as DbPhone[]).map(p => mapPhone(p as DbPhone)),
    emails: (emails as DbEmail[]).map(e => mapEmail(e as DbEmail)),
    tags: (tagRels as { tags: DbTag | null }[]).map(r => r.tags && mapTag(r.tags as DbTag)).filter(Boolean) as TagRef[],
    organizationId: orgId,
  }
}

/** Liste paginée avec filtres, exécution au niveau SQL (ILIKE full-text). */
export async function listContacts(orgId: string, opts: ContactListOpts): Promise<{ rows: ContactRow[]; total: number }> {
  const db = serviceDb()
  if (!db) return { rows: [], total: 0 }

  const q = (opts.q ?? '').trim()

  // Prépare q pour un motif ILIKE : jokers échappés, guillemets retirés
  // (les valeurs de or(...) sont délimiteées par double quotes pour survivre aux virgules/parenthèses).
  const pat = ("%" + q.replace(/"\\/g, '').replace(/%/g, '\\%').replace(/_/g, '\\_') + "%")

  // 1) Contacts retrouvés via leurs sous-entités (téléphones / emails).
  //    On collecte d'abord leurs ids, puis on combine avec la recherche sur la fiche.
  let childIds: string[] = []
  if (q) {
    const [ph, em] = await Promise.all([
      db.from('contact_phones').select('contact_id').eq('organization_id', orgId)
        .or(`normalized_phone.ilike."${pat}",raw_phone.ilike."${pat}"`),
      db.from('contact_emails').select('contact_id').eq('organization_id', orgId)
        .ilike('email', pat),
    ])
    childIds = [...new Set([
      ...((ph.data ?? []) as { contact_id: string }[]).map(r => r.contact_id),
      ...((em.data ?? []) as { contact_id: string }[]).map(r => r.contact_id),
    ])]
  }

  const col = opts.sort === 'name' ? 'full_name' : 'created_at'
  const ascending = opts.dir !== 'desc'

  // Jointure stricte (!inner) quand on filtre sur un tag : sinon le filtre
  // s'applique aux lignes embarquées et n'élimine pas les contacts parents.
  const tagActive = Boolean(opts.tag)
  const selectStr = [
    '*',
    'contact_phones(*)',
    'contact_emails(*)',
    `contact_tags${tagActive ? '!inner' : ''}(tags${tagActive ? '!inner' : ''}(id, name, color))`,
  ].join(', ')

  let query = db
    .from('contacts')
    .select(selectStr, { count: 'exact' })
    // Cloisonnement multi-tenant obligatoire
    .eq('organization_id', orgId)
    .is('merged_into', null)

  // Filtre validité téléphonique : ids de contacts dont le téléphone principal est
  // valide (is_valid=true) ou invalide (is_valid=false ou null).
  // Les ids sont ensuite interrogés PAR CHUNKS (un `in()` de milliers d'UUIDs
  // dépasse la limite d'URL de PostgREST).
  const phoneFilterActive = opts.phoneValid === 'valid' || opts.phoneValid === 'invalid'
  let phoneIds: string[] = []
  if (phoneFilterActive) {
    const [validRes, nullRes, badRes] = await Promise.all([
      db.from('contact_phones').select('contact_id').eq('organization_id', orgId)
        .eq('is_primary', true).eq('is_valid', true).limit(20000),
      db.from('contact_phones').select('contact_id').eq('organization_id', orgId)
        .eq('is_primary', true).is('is_valid', null).limit(20000),
      db.from('contact_phones').select('contact_id').eq('organization_id', orgId)
        .eq('is_primary', true).eq('is_valid', false).limit(20000),
    ])
    phoneIds = opts.phoneValid === 'valid'
      ? [...new Set(((validRes.data ?? []) as unknown as { contact_id: string }[]).map(r => r.contact_id))]
      : [...new Set([
          ...(((nullRes.data ?? []) as unknown as { contact_id: string }[]).map(r => r.contact_id)),
          ...(((badRes.data ?? []) as unknown as { contact_id: string }[]).map(r => r.contact_id)),
        ])]
  }
  if (opts.country) query = query.eq('country_iso2', opts.country)
  if (opts.source) query = query.eq('source', opts.source)
  if (opts.tag) query = query.filter('contact_tags.tags.name', 'eq', opts.tag)

  if (q) {
    // id des fiches correspondant sur les colonnes parentes (nom / entreprise / ville / notes)
    const parentRes = await db.from('contacts').select('id')
      .eq('organization_id', orgId).is('merged_into', null)
      .or(`full_name.ilike."${pat}",company.ilike."${pat}",city.ilike."${pat}",notes.ilike."${pat}"`)
    const parentIds = ((parentRes.data ?? []) as { id: string }[]).map(r => r.id)
    const all = [...new Set([...parentIds, ...childIds])].slice(0, 3000) // borne l'URL
    if (all.length === 0) return { rows: [], total: 0 }
    query = query.in('id', all)
  }

  if (phoneFilterActive) {
    // avec ce filtre, chargement par chunks puis tri/pagination mémoire déterministe
    const off = opts.offset ?? 0
    const lim = opts.limit ?? 25
    const collected: ContactEmbedded[] = []
    for (let i = 0; i < phoneIds.length; i += 200) {
      const { data } = await db.from('contacts').select(selectStr, { count: 'exact' })
        .eq('organization_id', orgId).is('merged_into', null)
        .in('id', phoneIds.slice(i, i + 200))
      if (data) collected.push(...((data ?? []) as unknown as ContactEmbedded[]))
    }
    // déduplication + filtres compatibles + tri + pagination côté serveur
    const seen = new Set<string>()
    const unique = collected.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    const filtered = unique.filter(r =>
      (!opts.country || r.country_iso2 === opts.country) &&
      (!opts.source || r.source === opts.source) &&
      (!opts.tag || (r.contact_tags ?? []).some(rel => rel?.tags?.name === opts.tag)))
    filtered.sort((a, b) => {
      const ka = col === 'full_name' ? String(a.full_name ?? '') : String(a.created_at ?? '')
      const kb = col === 'full_name' ? String(b.full_name ?? '') : String(b.created_at ?? '')
      const cmp = ka.localeCompare(kb)
      return ascending ? cmp : -cmp
    })
    return {
      rows: filtered.slice(off, off + lim).map(cc =>
        embeddedToRow(orgId, cc, cc.contact_phones ?? [], cc.contact_emails ?? [], cc.contact_tags ?? [])),
      total: filtered.length,
    }
  }

  const { data, error, count } = await query
    .order(col, { ascending, nullsFirst: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 25) - 1)

  if (error) return { rows: [], total: 0 }
  const rows = ((data ?? []) as unknown as ContactEmbedded[]).map(cc => {
    return embeddedToRow(orgId, cc, cc.contact_phones ?? [], cc.contact_emails ?? [], cc.contact_tags ?? [])
  })
  return { rows, total: count ?? rows.length }
}

/** Transformation IN-en-chunks d'une liste de contacts. */
export async function contactsByIds(orgId: string, ids: string[]): Promise<DbContact[]> {
  const db = serviceDb()
  if (!db || ids.length === 0) return []
  const acc: DbContact[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('contacts').select('*').eq('organization_id', orgId)
      .in('id', ids.slice(i, i + 200))
    if (data) acc.push(...(data as unknown as DbContact[]))
  }
  return acc
}

/**
 * Liste légère de tous les contacts actifs pour les agrégats. Pagination
 * explicite : PostgREST renvoie au maximum 1000 lignes par requête, une limite
 * simple tronquerait silencieusement les comptages au-delà de 10 000 contacts.
 */
export async function activeContactsLite(
  orgId: string,
  cols = 'id, full_name, company, source, city, country_iso2, country_name, region, notes, job_title, first_name, last_name, created_at, updated_at'
): Promise<DbContact[]> {
  const db = serviceDb()
  if (!db) return []
  return selectAllRows<DbContact>((from, to) =>
    db.from('contacts').select(cols).eq('organization_id', orgId)
      .is('merged_into', null)
      .order('id', { ascending: true }).range(from, to))
}

/** Journal d'activité (écriture centralisée). */
export async function logActivity(
  orgId: string, uid: string, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}
) {
  const db = serviceDb()
  if (!db) return
  await db.from('activity_logs').insert({ organization_id: orgId, action, entity, entity_id: entityId, uid, details })
}
