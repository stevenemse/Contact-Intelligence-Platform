import 'server-only'
import { serviceDb } from './server'
import { selectAllRows } from './pagination'
import { str, num } from './helpers'
import type { DbContact } from './data'

export const COUNTRY_NAMES: Record<string, string> = {
  CM: 'Cameroun', FR: 'France', BE: 'Belgique', CH: 'Suisse', CA: 'Canada', US: 'États-Unis',
  GB: 'Royaume-Uni', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', NL: 'Pays-Bas', PT: 'Portugal',
  SN: 'Sénégal', CI: "Côte d'Ivoire", NG: 'Nigeria', GH: 'Ghana', CD: 'RD Congo', GA: 'Gabon',
  CG: 'Congo', TD: 'Tchad', CF: 'Centrafrique', MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie',
  ZA: 'Afrique du Sud', KE: 'Kenya', RW: 'Rwanda', BI: 'Burundi', TZ: 'Tanzanie', UG: 'Ouganda',
  ET: 'Éthiopie', LU: 'Luxembourg', AT: 'Autriche', SE: 'Suède', NO: 'Norvège', DK: 'Danemark',
  FI: 'Finlande', PL: 'Pologne', TR: 'Turquie', BR: 'Brésil', CN: 'Chine', IN: 'Inde',
  AE: 'Émirats arabes unis', QA: 'Qatar', SA: 'Arabie saoudite', RU: 'Russie', MX: 'Mexique',
  AR: 'Argentine', CL: 'Chili', CO: 'Colombie', AU: 'Australie', NZ: 'Nouvelle-Zélande',
  BF: 'Burkina Faso', NE: 'Niger', TG: 'Togo', BJ: 'Bénin', GM: 'Gambie', ML: 'Mali',
  LR: 'Liberia', SL: 'Sierra Leone', AO: 'Angola', GQ: 'Guinée équatoriale', MZ: 'Mozambique',
  ZM: 'Zambie', MG: 'Madagascar', ZW: 'Zimbabwe', NA: 'Namibie', MW: 'Malawi', LS: 'Lesotho',
  BW: 'Botswana', SZ: 'Eswatini', KM: 'Comores', MU: 'Maurice', RE: 'Réunion', LY: 'Libye',
  EG: 'Égypte', DJ: 'Djibouti', SO: 'Somalie', EH: 'Sahara occidental', SS: 'Soudan du Sud',
  ER: 'Érythrée', GN: 'Guinée', GR: 'Grèce', IE: 'Irlande', HU: 'Hongrie', CZ: 'Tchéquie',
  SK: 'Slovaquie', UA: 'Ukraine', RO: 'Roumanie', BG: 'Bulgarie', HR: 'Croatie', SI: 'Slovénie',
  LT: 'Lituanie', LV: 'Lettonie', EE: 'Estonie', RS: 'Serbie', BA: 'Bosnie-Herzégovine',
  MK: 'Macédoine du Nord', AL: 'Albanie', ME: 'Monténégro', IS: 'Islande', BY: 'Biélorussie',
  MD: 'Moldavie', CY: 'Chypre', MT: 'Malte', PE: 'Pérou', VE: 'Venezuela', PK: 'Pakistan',
  BD: 'Bangladesh', ID: 'Indonésie', PH: 'Philippines', MY: 'Malaisie', TH: 'Thaïlande',
  VN: 'Vietnam', JP: 'Japon', KR: 'Corée du Sud', BH: 'Bahreïn', OM: 'Oman', JO: 'Jordanie',
  LB: 'Liban', SY: 'Syrie', IR: 'Iran', EC: 'Équateur', DO: 'République dominicaine',
  HT: 'Haïti', JM: 'Jamaïque', CN2: 'Chine',
}

export function countryLabel(iso2: string | null): string {
  if (!iso2) return ''
  return COUNTRY_NAMES[iso2.toUpperCase()] ?? iso2
}

export type CountryAgg = { iso2: string; name: string; n: number }

/** Distincts : pays (contacts actifs), sources, tags nommés. */
export async function contactsFiltersData(orgId: string): Promise<{
  countries: { iso2: string; name: string }[]
  sources: string[]
  tags: string[]
}> {
  const db = serviceDb()
  if (!db) return { countries: [], sources: [], tags: [] }
  const [cRes, sRes, tRes] = await Promise.all([
    db.from('contacts').select('country_iso2, country_name')
      .eq('organization_id', orgId).is('merged_into', null).limit(10000),
    db.from('contacts').select('source')
      .eq('organization_id', orgId).is('merged_into', null).not('source', 'is', null).limit(10000),
    db.from('tags').select('name').eq('organization_id', orgId).order('name'),
  ])
  const countriesMap = new Map<string, string>()
  for (const c of ((cRes.data ?? []) as unknown as { country_iso2: string | null; country_name: string | null }[])) {
    const iso = str(c.country_iso2).toUpperCase()
    if (!iso) continue
    if (!countriesMap.has(iso)) countriesMap.set(iso, str(c.country_name) || countryLabel(iso))
  }
  const countries = [...countriesMap.entries()]
    .map(([iso2, name]) => ({ iso2, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const sources = [...new Set(
    ((sRes.data ?? []) as unknown as { source: string | null }[]).map(r => str(r.source)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'fr'))
  const tags = ((tRes.data ?? []) as unknown as { name: string | null }[]).map(r => str(r.name)).filter(Boolean)
  return { countries, sources, tags }
}

/**
 * Pays réellement exploitables : `country_iso2` quand il est renseigné, sinon
 * l'indicatif du téléphone principal (c'est la donnée qui existe vraiment dans
 * les fichiers importés). Sert aux filtres et à l'export par pays.
 */
export async function effectiveCountryData(orgId: string): Promise<{
  countries: CountryAgg[]
  total: number
}> {
  const db = serviceDb()
  if (!db) return { countries: [], total: 0 }
  const [contacts, phones] = await Promise.all([
    selectAllRows<{ id: string; country_iso2: string | null }>((from, to) =>
      db.from('contacts').select('id, country_iso2')
        .eq('organization_id', orgId).is('merged_into', null)
        .order('id', { ascending: true }).range(from, to)),
    selectAllRows<{ contact_id: string; country_code: string | null }>((from, to) =>
      db.from('contact_phones').select('contact_id, country_code')
        .eq('organization_id', orgId).eq('is_primary', true)
        .order('id', { ascending: true }).range(from, to)),
  ])
  const phoneCountry = new Map<string, string>()
  for (const p of phones) {
    const iso = str(p.country_code).toUpperCase()
    if (iso && !phoneCountry.has(str(p.contact_id))) phoneCountry.set(str(p.contact_id), iso)
  }
  const counts = new Map<string, number>()
  for (const c of contacts) {
    const iso = str(c.country_iso2).toUpperCase() || phoneCountry.get(str(c.id)) || ''
    if (!iso) continue
    counts.set(iso, (counts.get(iso) ?? 0) + 1)
  }
  const countries = [...counts.entries()]
    .map(([iso2, n]) => ({ iso2, name: countryLabel(iso2), n }))
    .sort((a, b) => b.n - a.n)
  return { countries, total: contacts.length }
}

/** Listes distinctes pour le segment builder (pays, sources, villes, tags). */
export async function segmentBuilderData(orgId: string): Promise<{
  countries: { iso2: string; name: string }[]
  sources: string[]
  cities: string[]
  tags: string[]
}> {
  const [base, effective] = await Promise.all([
    contactsFiltersData(orgId),
    effectiveCountryData(orgId),
  ])
  const db = serviceDb()
  let cities: string[] = []
  if (db) {
    const { data } = await db.from('contacts').select('city')
      .eq('organization_id', orgId).is('merged_into', null).not('city', 'is', null).limit(10000)
    cities = [...new Set(((data ?? []) as unknown as { city: string | null }[]).map(r => str(r.city)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr'))
  }
  return {
    countries: effective.countries.map(c => ({ iso2: c.iso2, name: c.name })),
    sources: base.sources,
    cities,
    tags: base.tags,
  }
}

export type DupReason = { label: string; points: number; tone: 'positive' | 'warning' }
export type DupConfidence = 'quasi_certain' | 'probable' | 'a_verifier'
export type DupScore = { score: number; confidence: DupConfidence; reasons: DupReason[] }
export type DupGroup = { normalized_phone: string; n: number; contact_ids: string[]; score: DupScore }
export type DupPhone = { phone: string; isPrimary: boolean; isValid: boolean }
export type DupContact = {
  fullName: string | null
  company: string | null
  jobTitle: string | null
  source: string | null
  countryIso2: string | null
  countryName: string | null
  city: string | null
  phones: DupPhone[]
  tags: { name: string; color: string }[]
  emails: { email: string }[] | null
}

/**
 * Groupes de doublons : le téléphone partagé crée le groupe, puis les autres
 * champs classent prudemment la correspondance. Aucune fusion n'est automatique.
 */
function comparable(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = old
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}

function scoreDuplicatePair(a: DupContact, b: DupContact): DupScore {
  const reasons: DupReason[] = [{ label: 'Téléphone normalisé identique', points: 50, tone: 'positive' }]
  let score = 50
  const emailsA = new Set((a.emails ?? []).map(e => comparable(e.email)))
  const emailMatch = (b.emails ?? []).some(e => emailsA.has(comparable(e.email)) && comparable(e.email))
  if (emailMatch) { score += 35; reasons.push({ label: 'Email identique', points: 35, tone: 'positive' }) }

  const nameSimilarity = similarity(comparable(a.fullName), comparable(b.fullName))
  if (nameSimilarity >= 0.88) { score += 25; reasons.push({ label: 'Noms très proches', points: 25, tone: 'positive' }) }
  else if (nameSimilarity >= 0.72) { score += 15; reasons.push({ label: 'Noms proches', points: 15, tone: 'positive' }) }

  const companySimilarity = similarity(comparable(a.company), comparable(b.company))
  if (companySimilarity >= 0.88) { score += 15; reasons.push({ label: 'Entreprises très proches', points: 15, tone: 'positive' }) }
  else if (companySimilarity >= 0.72) { score += 8; reasons.push({ label: 'Entreprises proches', points: 8, tone: 'positive' }) }

  const sameLocation = Boolean(comparable(a.city) && comparable(a.city) === comparable(b.city)) ||
    Boolean(comparable(a.countryIso2) && comparable(a.countryIso2) === comparable(b.countryIso2))
  if (sameLocation) { score += 5; reasons.push({ label: 'Même ville ou pays', points: 5, tone: 'positive' }) }

  const contradictory = Boolean(comparable(a.fullName) && comparable(b.fullName) && nameSimilarity < 0.3) ||
    Boolean(emailMatch === false && (a.emails ?? []).length > 0 && (b.emails ?? []).length > 0 &&
      ![...emailsA].some(Boolean))
  if (contradictory) { score -= 10; reasons.push({ label: 'Données contradictoires', points: -10, tone: 'warning' }) }

  const finalScore = Math.max(0, Math.min(100, score))
  const confidence: DupConfidence = finalScore >= 90 ? 'quasi_certain' : finalScore >= 75 ? 'probable' : 'a_verifier'
  return { score: finalScore, confidence, reasons }
}

function scoreDuplicateGroup(ids: string[], contacts: Record<string, DupContact>): DupScore {
  const pairs: DupScore[] = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = contacts[ids[i]], b = contacts[ids[j]]
    if (a && b) pairs.push(scoreDuplicatePair(a, b))
  }
  return pairs.sort((a, b) => b.score - a.score)[0] ?? {
    score: 50, confidence: 'a_verifier',
    reasons: [{ label: 'Téléphone normalisé identique', points: 50, tone: 'positive' }],
  }
}
export async function dupDetectionData(orgId: string): Promise<{
  groups: DupGroup[]
  contacts: Record<string, DupContact>
  totalDupes: number
}> {
  const db = serviceDb()
  if (!db) return { groups: [], contacts: {}, totalDupes: 0 }
  const [phRes, emRes] = await Promise.all([
    db.from('contact_phones').select('contact_id, normalized_phone, is_primary, is_valid')
      .eq('organization_id', orgId).not('normalized_phone', 'is', null).limit(20000),
    db.from('contact_emails').select('contact_id, email, is_primary').eq('organization_id', orgId).limit(20000),
  ])
  const byContactId = new Map<string, { ph: string | null; phones: DupPhone[]; emails: { email: string }[] }>()
  for (const p of ((phRes.data ?? []) as unknown as { contact_id: string; normalized_phone: string | null; is_primary: boolean | null; is_valid: boolean | null }[])) {
    const cid = str(p.contact_id)
    const entry = byContactId.get(cid) ?? { ph: null, phones: [], emails: [] }
    if (p.normalized_phone) {
      entry.phones.push({ phone: p.normalized_phone, isPrimary: Boolean(p.is_primary), isValid: Boolean(p.is_valid) })
      if (p.is_primary) entry.ph = p.normalized_phone
    }
    byContactId.set(cid, entry)
  }
  for (const e of ((emRes.data ?? []) as unknown as { contact_id: string; email: string | null; is_primary: boolean | null }[])) {
    const cid = str(e.contact_id)
    const entry = byContactId.get(cid) ?? { ph: null, phones: [], emails: [] }
    entry.emails.push({ email: str(e.email) })
    byContactId.set(cid, entry)
  }

  const phoneMap = new Map<string, string[]>()
  for (const [cid, e] of byContactId) {
    if (!e.ph) continue
    const list = phoneMap.get(e.ph) ?? []
    list.push(cid)
    phoneMap.set(e.ph, list)
  }
  const groups: DupGroup[] = [...phoneMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalized_phone, ids]) => ({
      normalized_phone,
      n: ids.length,
      contact_ids: ids,
      score: { score: 50, confidence: 'a_verifier' as DupConfidence, reasons: [{ label: 'Téléphone normalisé identique', points: 50, tone: 'positive' as const }] },
    }))
    .sort((a, b) => b.n - a.n)

  const ids = [...new Set(groups.flatMap(g => g.contact_ids))]
  const contacts: Record<string, DupContact> = {}
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data } = await db.from('contacts').select('*')
        .eq('organization_id', orgId).in('id', chunk)
      // groupes (tags) de chaque fiche : visibles avant la fusion
      const tagsByContact = new Map<string, { name: string; color: string }[]>()
      const { data: tagRows } = await db.from('contact_tags')
        .select('contact_id, tags(name, color)')
        .eq('organization_id', orgId).in('contact_id', chunk)
      for (const row of ((tagRows ?? []) as unknown as {
        contact_id: string | null
        tags: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null
      }[])) {
        const ref = Array.isArray(row.tags) ? row.tags[0] : row.tags
        if (!ref || !str(ref.name)) continue
        const cid = str(row.contact_id)
        const list = tagsByContact.get(cid) ?? []
        list.push({ name: str(ref.name), color: str(ref.color) || '#2563eb' })
        tagsByContact.set(cid, list)
      }
      for (const c of ((data ?? []) as unknown as DbContact[])) {
        const entry = byContactId.get(str(c.id)) ?? { ph: null, phones: [], emails: [] }
        contacts[str(c.id)] = {
          fullName: c.full_name,
          company: c.company,
          jobTitle: c.job_title,
          source: c.source,
          countryIso2: c.country_iso2,
          countryName: c.country_name,
          city: c.city,
          // numéro principal en tête : on voit immédiatement ce qui est fusionné
          phones: [...entry.phones].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
          tags: tagsByContact.get(str(c.id)) ?? [],
          emails: entry.emails,
        }
      }
    }
  }
  for (const group of groups) group.score = scoreDuplicateGroup(group.contact_ids, contacts)
  const totalDupes = groups.reduce((acc, g) => acc + g.n - 1, 0)
  return { groups, contacts, totalDupes }
}

const CALLING: Record<string, string> = {
  CM: '237', BF: '226', BJ: '229', CI: '225', GA: '241', CG: '242', CF: '236', TD: '235',
  TG: '228', ML: '223', NE: '227', SN: '221', GM: '220', CD: '243', FR: '33', BE: '32',
  CH: '41', CA: '1', US: '1', GB: '44', DE: '49', ES: '34', IT: '39', NL: '31', NG: '234',
  GH: '233', MA: '212', DZ: '213', TN: '216', ZA: '27', KE: '254', AE: '971', IN: '91',
  CN: '86', BR: '55', PT: '351', LU: '352', RU: '7', TR: '90', MX: '52', AU: '61',
}

/**
 * Répartition par indicatif du numéro principal (provenance réelle des
 * numéros). Utilisée par la page /map et par le dashboard, qui passent leurs
 * lignes téléphones déjà chargées — évite un second chargement complet.
 */
export function phoneCountryStats(phoneRows: { country_code: string | null; is_valid: boolean | null }[]): {
  iso2: string; callingCode: string; name: string; n: number; invalid: number
}[] {
  const phoneCount = new Map<string, { iso2: string; n: number; invalid: number }>()
  for (const p of phoneRows) {
    const iso = str(p.country_code).toUpperCase()
    if (!iso) continue // inconnu : non projetable
    const cur = phoneCount.get(iso) ?? { iso2: iso, n: 0, invalid: 0 }
    cur.n++
    if (!p.is_valid) cur.invalid++
    phoneCount.set(iso, cur)
  }
  return [...phoneCount.entries()]
    .map(([iso2, v]) => ({
      iso2,
      callingCode: CALLING[iso2] ?? '?',
      name: countryLabel(iso2),
      n: v.n,
      invalid: v.invalid,
    }))
    .sort((a, b) => b.n - a.n)
}

/** Agrégats carte : volume par pays + villes (drill-down) + sources. */
export async function mapData(orgId: string): Promise<{
  byCountry: { iso2: string; name: string; n: number }[]
  byCity: { name: string; country_iso2: string; n: number }[]
  sources: string[]
  /** pays déduit de l'indicatif du téléphone principal (couleur de la carte) */
  byPhoneCountry: { iso2: string; callingCode: string; name: string; n: number; invalid: number }[]
}> {
  const db = serviceDb()
  if (!db) return { byCountry: [], byCity: [], sources: [], byPhoneCountry: [] }
  // agrégats paginés : une limite simple tronquerait silencieusement au-delà de
  // 1000 lignes par requête, donc des chiffres faux sur les grosses bases
  const [contactRows, phoneRows, { sources }] = await Promise.all([
    selectAllRows<{ country_iso2: string | null; city: string | null }>((from, to) =>
      db.from('contacts').select('country_iso2, city')
        .eq('organization_id', orgId).is('merged_into', null)
        .order('id', { ascending: true }).range(from, to)),
    selectAllRows<{ country_code: string | null; is_valid: boolean | null }>((from, to) =>
      db.from('contact_phones').select('country_code, is_valid, is_primary')
        .eq('organization_id', orgId).eq('is_primary', true)
        .order('id', { ascending: true }).range(from, to)),
    contactsFiltersData(orgId),
  ])
  const countryCount = new Map<string, number>()
  const cityCount = new Map<string, { country_iso2: string; n: number }>()
  for (const c of contactRows) {
    const iso = str(c.country_iso2).toUpperCase()
    if (iso) countryCount.set(iso, (countryCount.get(iso) ?? 0) + 1)
    const city = str(c.city)
    if (city && iso) {
      const key = `${city}|${iso}`
      const cur = cityCount.get(key) ?? { country_iso2: iso, n: 0 }
      cur.n++
      cityCount.set(key, cur)
    }
  }
  const byCountry = [...countryCount.entries()]
    .map(([iso2, n]) => ({ iso2, name: countryLabel(iso2), n }))
    .sort((a, b) => b.n - a.n)
  const byCity = [...cityCount.entries()]
    .map(([key, v]) => ({ name: key.split('|')[0], country_iso2: v.country_iso2, n: v.n }))
    .sort((a, b) => b.n - a.n)

  // Comptage par indicatif du téléphone principal (helper partagé dashboard)
  const byPhoneCountry = phoneCountryStats(phoneRows).sort((a, b) => b.n - a.n)

  return { byCountry, byCity, sources, byPhoneCountry }
}

/** Petite aide pour formater des lignes d'historique. */
export function fmtDate(iso: string): string {
  return str(iso).slice(0, 16).replace('T', ' ')
}

export { num }
export { str } from './helpers'
