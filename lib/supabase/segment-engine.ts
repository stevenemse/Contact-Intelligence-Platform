import 'server-only'
import { loadRelations } from './data'
import { selectAllRows } from './pagination'

/**
 * Mêmes règles que l'affichage du segment-builder :
 *   { and: [...] } → toutes les règles vraies
 *   { or:  [...] } → au moins une règle vraie
 *   { not: [...] } → aucune règle vraie
 * Chaque groupe indépendant est évalué ; un contact qui passe au moins un groupe
 * est sélectionné (union des groupes).
 */

export type SegmentRule = { field: string; op: string; value?: string }
export type SegmentGroup = { and: SegmentRule[]; or: SegmentRule[]; not: SegmentRule[] }

type EnrichedContact = {
  id: string
  data: Record<string, unknown>
  tags: string[]
  phoneValid: boolean
}

export function validateSegmentRules(raw: unknown): { ok: boolean; error?: string; groups?: SegmentGroup[] } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'rules doit être un tableau non vide' }
  const groups: SegmentGroup[] = []
  for (const g of raw as unknown[]) {
    if (typeof g !== 'object' || g === null) return { ok: false, error: 'Groupe invalide' }
    const gg = g as Record<string, unknown>
    const group: SegmentGroup = {
      and: Array.isArray(gg.and) ? gg.and as SegmentRule[] : [],
      or: Array.isArray(gg.or) ? gg.or as SegmentRule[] : [],
      not: Array.isArray(gg.not) ? gg.not as SegmentRule[] : [],
    }
    if (group.and.length + group.or.length + group.not.length === 0) {
      return { ok: false, error: 'Groupe vide' }
    }
    groups.push(group)
  }
  return { ok: true, groups }
}

function fieldValues(field: string, c: EnrichedContact): string {
  const d = c.data as Record<string, unknown>
  switch (field) {
    case 'full_name':
      return String(d.full_name ?? d.fullName ?? [d.first_name, d.last_name].filter(Boolean).join(' ')).toLowerCase()
    case 'company': return String(d.company ?? '').toLowerCase()
    case 'job_title': return String(d.job_title ?? '').toLowerCase()
    case 'source': return String(d.source ?? '').toLowerCase()
    case 'notes': return String(d.notes ?? '').toLowerCase()
    // pays effectif : country_iso2 si renseigné, sinon l'indicatif du tél. principal
    case 'country': return String(d.country_iso2 ?? d.__phoneCountry ?? '').toLowerCase()
    case 'city': return String(d.city ?? '').toLowerCase()
    case 'email': return String(d.email ?? '').toLowerCase()
    default: return ''
  }
}

function testRule(rule: SegmentRule, c: EnrichedContact): boolean {
  const op = rule.op
  if (rule.field === 'phone_valid') {
    const want = rule.value === 'true'
    return op === 'eq' ? c.phoneValid === want : op === 'neq' ? c.phoneValid !== want : false
  }
  if (rule.field === 'tag') {
    const wanted = String(rule.value ?? '').toLowerCase()
    switch (op) {
      case 'eq': return c.tags.some(t => t.toLowerCase() === wanted)
      case 'neq': return !c.tags.some(t => t.toLowerCase() === wanted)
      case 'contains': return c.tags.some(t => t.toLowerCase().includes(wanted))
      case 'starts_with': return c.tags.some(t => t.toLowerCase().startsWith(wanted))
      case 'is_empty': return c.tags.length === 0
      case 'not_empty': return c.tags.length > 0
      default: return false
    }
  }
  const actual = fieldValues(rule.field, c)
  const v = String(rule.value ?? '').toLowerCase()
  switch (op) {
    case 'eq': return actual === v
    case 'neq': return actual !== v
    case 'contains': return actual.includes(v)
    case 'starts_with': return actual.startsWith(v)
    case 'is_empty': return actual.length === 0
    case 'not_empty': return actual.length > 0
    case 'gt': return actual > v
    case 'lt': return actual < v
    default: return false
  }
}

function testGroup(g: SegmentGroup, c: EnrichedContact): boolean {
  const andOk = g.and.every(r => testRule(r, c))
  const orOk = g.or.length === 0 || g.or.some(r => testRule(r, c))
  const notOk = g.not.every(r => !testRule(r, c))
  return andOk && orOk && notOk
}

/** Applique les groupes sur la liste enrichie, renvoie les ids qui matchent. */
export function applySegmentGroups(groups: SegmentGroup[], contacts: EnrichedContact[]): string[] {
  return contacts.filter(c => groups.some(g => testGroup(g, c))).map(c => c.id)
}

/**
 * Enrichit les contacts actifs d'une organisation : emails principaux + tags + validité du téléphone.
 * (2–3 requêtes SQL, sans le moindre scan Firestore.)
 */
export async function loadEnrichedContacts(orgId: string): Promise<EnrichedContact[]> {
  const { serviceDb } = await import('./server')
  const db = serviceDb()
  if (!db) return []

  const [contacts, rel, phoneRows] = await Promise.all([
    selectAllRows<Record<string, unknown>>((from, to) =>
      db.from('contacts').select('*').eq('organization_id', orgId).is('merged_into', null)
        .order('id', { ascending: true }).range(from, to)),
    loadRelations(orgId, []),
    selectAllRows<{ contact_id: string; is_valid: boolean | null; country_code: string | null }>((from, to) =>
      db.from('contact_phones').select('contact_id, is_valid, country_code')
        .eq('organization_id', orgId).eq('is_primary', true)
        .order('id', { ascending: true }).range(from, to)),
  ])

  // emails principaux
  const emRows = await selectAllRows<{ contact_id: string; email: string | null; is_primary: boolean | null }>((from, to) =>
    db.from('contact_emails').select('contact_id, email, is_primary')
      .eq('organization_id', orgId).order('id', { ascending: true }).range(from, to))
  const primaryEmailByContact = new Map<string, string>()
  for (const e of emRows) {
    const prev = primaryEmailByContact.get(e.contact_id)
    if (e.is_primary || !prev) primaryEmailByContact.set(e.contact_id, e.email ?? '')
  }

  const phoneValid = new Set<string>()
  const phoneCountry = new Map<string, string>()
  for (const p of phoneRows) {
    if (p.is_valid) phoneValid.add(p.contact_id)
    const iso = (p.country_code ?? '').toUpperCase()
    if (iso && !phoneCountry.has(p.contact_id)) phoneCountry.set(p.contact_id, iso)
  }

  // tags
  const tagRels = await selectAllRows<{ contact_id: string; tag_id: string }>((from, to) =>
    db.from('contact_tags').select('contact_id, tag_id')
      .eq('organization_id', orgId).order('contact_id', { ascending: true }).range(from, to))
  const tagNames = await db.from('tags').select('id, name').eq('organization_id', orgId)
  const tagNameById = new Map(
    ((tagNames.data ?? []) as unknown as { id: string; name: string | null }[])
      .map(t => [t.id, t.name ?? ''])
  )
  const tagsByContact = new Map<string, string[]>()
  for (const r of tagRels) {
    const name = tagNameById.get(r.tag_id)
    if (!name) continue
    const list = tagsByContact.get(r.contact_id) ?? []
    list.push(name)
    tagsByContact.set(r.contact_id, list)
  }

  void rel // loadRelations est surcoût ici ; emails/phones/tags déjà chargés directement

  return contacts.map(c => ({
    id: String(c.id),
    data: {
      ...c,
      email: primaryEmailByContact.get(String(c.id)) ?? '',
      __phoneCountry: phoneCountry.get(String(c.id)) ?? '',
    },
    tags: tagsByContact.get(String(c.id)) ?? [],
    phoneValid: phoneValid.has(String(c.id)),
  }))
}
