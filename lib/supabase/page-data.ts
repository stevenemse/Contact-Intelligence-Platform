import 'server-only'
import { serviceDb } from './server'
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

/** Listes distinctes pour le segment builder (pays, sources, villes, tags). */
export async function segmentBuilderData(orgId: string): Promise<{
  countries: { iso2: string; name: string }[]
  sources: string[]
  cities: string[]
  tags: string[]
}> {
  const base = await contactsFiltersData(orgId)
  const db = serviceDb()
  let cities: string[] = base.tags.length >= 0 ? [] : []
  if (db) {
    const { data } = await db.from('contacts').select('city')
      .eq('organization_id', orgId).is('merged_into', null).not('city', 'is', null).limit(10000)
    cities = [...new Set(((data ?? []) as unknown as { city: string | null }[]).map(r => str(r.city)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr'))
  }
  return { countries: base.countries, sources: base.sources, cities, tags: base.tags }
}

export type DupGroup = { normalized_phone: string; n: number; contact_ids: string[] }
export type DupContact = {
  fullName: string | null
  company: string | null
  jobTitle: string | null
  source: string | null
  countryName: string | null
  city: string | null
  emails: { email: string }[] | null
}

/**
 * Groupes de doublons : numéros primaires normalisés partagés par 2+ contacts actifs.
 * Renvoie aussi les fiches affichées (nom, entreprise, emails...).
 */
export async function dupDetectionData(orgId: string): Promise<{
  groups: DupGroup[]
  contacts: Record<string, DupContact>
  totalDupes: number
}> {
  const db = serviceDb()
  if (!db) return { groups: [], contacts: {}, totalDupes: 0 }
  const [phRes, emRes] = await Promise.all([
    db.from('contact_phones').select('contact_id, normalized_phone, is_primary')
      .eq('organization_id', orgId).not('normalized_phone', 'is', null).limit(20000),
    db.from('contact_emails').select('contact_id, email, is_primary').eq('organization_id', orgId).limit(20000),
  ])
  const byContactId = new Map<string, { ph: string | null; emails: { email: string }[] }>()
  for (const p of ((phRes.data ?? []) as unknown as { contact_id: string; normalized_phone: string | null; is_primary: boolean | null }[])) {
    const entry = byContactId.get(str(p.contact_id)) ?? { ph: null, emails: [] }
    if (p.is_primary && p.normalized_phone) entry.ph = p.normalized_phone
    byContactId.set(str(p.contact_id), entry)
  }
  for (const e of ((emRes.data ?? []) as unknown as { contact_id: string; email: string | null; is_primary: boolean | null }[])) {
    const entry = byContactId.get(str(e.contact_id)) ?? { ph: null, emails: [] }
    entry.emails.push({ email: str(e.email) })
    byContactId.set(str(e.contact_id), entry)
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
    .map(([normalized_phone, ids]) => ({ normalized_phone, n: ids.length, contact_ids: ids }))
    .sort((a, b) => b.n - a.n)

  const ids = [...new Set(groups.flatMap(g => g.contact_ids))]
  const contacts: Record<string, DupContact> = {}
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('contacts').select('*')
        .eq('organization_id', orgId).in('id', ids.slice(i, i + 200))
      for (const c of ((data ?? []) as unknown as DbContact[])) {
        const entry = byContactId.get(str(c.id)) ?? { ph: null, emails: [] }
        contacts[str(c.id)] = {
          fullName: c.full_name,
          company: c.company,
          jobTitle: c.job_title,
          source: c.source,
          countryName: c.country_name,
          city: c.city,
          emails: entry.emails,
        }
      }
    }
  }
  const totalDupes = groups.reduce((acc, g) => acc + g.n - 1, 0)
  return { groups, contacts, totalDupes }
}

/** Agrégats carte : volume par pays + villes (drill-down) + sources. */
export async function mapData(orgId: string): Promise<{
  byCountry: { iso2: string; name: string; n: number }[]
  byCity: { name: string; country_iso2: string; n: number }[]
  sources: string[]
}> {
  const db = serviceDb()
  if (!db) return { byCountry: [], byCity: [], sources: [] }
  const { data } = await db.from('contacts').select('country_iso2, city')
    .eq('organization_id', orgId).is('merged_into', null).limit(10000)
  const countryCount = new Map<string, number>()
  const cityCount = new Map<string, { country_iso2: string; n: number }>()
  for (const c of ((data ?? []) as unknown as { country_iso2: string | null; city: string | null }[])) {
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
  const { sources } = await contactsFiltersData(orgId)
  return { byCountry, byCity, sources }
}

/** Petite aide pour formater des lignes d'historique. */
export function fmtDate(iso: string): string {
  return str(iso).slice(0, 16).replace('T', ' ')
}

export { num }
export { str } from './helpers'
