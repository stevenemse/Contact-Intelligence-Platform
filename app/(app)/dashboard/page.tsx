// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, num } from '@/lib/supabase/helpers'
import { activeContactsLite } from '@/lib/supabase/data'
import { mapData } from '@/lib/supabase/page-data'
import { getDictionary } from '@/lib/i18n/dictionaries'
import WorldMapSvg from '@/components/world-map-svg'
import { toFlag } from '@/lib/geo/flags'
import TodayLabel from '@/components/today-label'

/** En-tête de section avec lien "Voir tout" vers l'onglet correspondant. */
function SectionHeader({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="section-title">{title}</h3>
      <Link href={href} className="text-xs font-medium hover:underline" style={{ color: 'var(--brand-deep)' }}>
        {cta} →
      </Link>
    </div>
  )
}

export default async function DashboardPage() {
  const ctx = await requireOrg()
  const db = serviceDb()
  const t = getDictionary('fr')
  const org = ctx.orgId

  const lite = await activeContactsLite(org)
  const contacts = lite.map(c => ({
    id: str(c.id),
    source: str(c.source),
    iso2: str(c.country_iso2).toUpperCase(),
    countryName: str(c.country_name),
    createdAt: str(c.created_at),
    fullName: str(c.full_name),
    company: str(c.company),
  }))

  // validité des téléphones (primaire uniquement, contacts actifs)
  let validPrimary = 0
  let invalidPrimary = 0
  if (db) {
    const { data: ph } = await db.from('contact_phones')
      .select('contact_id, is_primary, is_valid')
      .eq('organization_id', org)
      .limit(20000)
    const merged = new Set(lite.map(c => str(c.id)))
    for (const p of ((ph ?? []) as unknown as { contact_id: string; is_primary: boolean | null; is_valid: boolean | null }[])) {
      if (!merged.has(str(p.contact_id))) continue
      if (!p.is_primary) continue
      if (p.is_valid === true) validPrimary++
      else invalidPrimary++
    }
  }

  // doublons : numéros primaires normalisés exploités par 2+ contacts actifs
  let dupGroups = 0
  const phoneContact = new Map<string, Set<string>>()
  if (db) {
    const { data: ph } = await db.from('contact_phones')
      .select('contact_id, normalized_phone, is_primary')
      .eq('organization_id', org)
      .not('normalized_phone', 'is', null)
      .limit(20000)
    const merged = new Set(lite.map(c => str(c.id)))
    for (const p of ((ph ?? []) as unknown as { contact_id: string; normalized_phone: string | null; is_primary: boolean | null }[])) {
      if (!p.is_primary || !p.normalized_phone) continue
      if (!merged.has(str(p.contact_id))) continue
      const set = phoneContact.get(p.normalized_phone) ?? new Set<string>()
      set.add(str(p.contact_id))
      phoneContact.set(p.normalized_phone, set)
    }
  }
  for (const set of phoneContact.values()) if (set.size > 1) dupGroups += set.size - 1

  // provenance par indicatif (carte + stats par pays) — sans villes
  const { byPhoneCountry } = await mapData(org)
  const mapCountries = byPhoneCountry.map(p => ({ iso2: p.iso2, name: p.name, n: p.n, invalid: p.invalid }))
  const maxN = Math.max(1, ...byPhoneCountry.map(p => p.n))

  // sources
  const sources = [...contacts.reduce<Map<string, number>>((acc, c) => {
    const s = c.source || 'non précisée'
    acc.set(s, (acc.get(s) ?? 0) + 1)
    return acc
  }, new Map()).entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n)

  // imports + exports récents
  const [importsRes, exportsRes] = await Promise.all([
    db ? db.from('import_batches').select('id, file_name, status, total_rows, new_contacts, duplicates_skipped, created_at')
        .eq('organization_id', org).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: null }),
    db ? db.from('export_runs').select('id, scope, row_count, created_at')
        .eq('organization_id', org).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: null }),
  ])
  const recentImports = ((importsRes.data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    id: str(r.id), file: str(r.file_name), status: str(r.status),
    added: num(r.new_contacts), skipped: num(r.duplicates_skipped), at: str(r.created_at),
  }))
  const recentExports = ((exportsRes.data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    id: str(r.id), scope: str(r.scope), rows: num(r.row_count), at: str(r.created_at),
  }))

  const recentContacts = [...contacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  const total = contacts.length
  const kpis = [
    { label: t.dash.total, value: total, href: '/contacts' },
    { label: t.dash.unique, value: total, href: '/contacts' },
    { label: t.dash.dupes, value: dupGroups, href: '/duplicates' },
    { label: t.dash.validPhones, value: validPrimary, href: '/contacts?phoneValid=valid' },
    { label: t.dash.invalidPhones, value: invalidPrimary, href: '/contacts?phoneValid=invalid' },
    { label: t.dash.countries, value: byPhoneCountry.length, href: '/map' },
  ]

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.dash.title}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {ctx.orgName} · <TodayLabel locale="fr-FR" />
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/imports/new" className="btn btn-primary">Importer un CSV</Link>
          <Link href="/exports/new" className="btn btn-ghost">Exporter</Link>
        </div>
      </div>

      {/* 1. KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Link href={k.href} key={k.label} className="kpi-card hover:opacity-90">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="metric mt-1">{k.value.toLocaleString('fr-FR')}</p>
          </Link>
        ))}
      </div>

      {/* 2. Carte réduite + stats par pays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="kpi-card lg:col-span-2">
          <SectionHeader title="Carte des numéros" href="/map" cta="Carte complète" />
          <WorldMapSvg countries={mapCountries} height={300} maxN={maxN} />
        </div>
        <div className="kpi-card">
          <SectionHeader title="Stats par pays" href="/map" cta="Voir tout" />
          <ul className="space-y-1.5">
            {byPhoneCountry.slice(0, 10).map(p => (
              <li key={p.iso2} className="flex items-center gap-2.5 text-sm">
                <span className="w-11 font-bold shrink-0">{toFlag(p.iso2)} +{p.callingCode}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <div className="w-20 rounded-full h-2 shrink-0" style={{ background: '#e3e9e6' }}>
                  <div className="h-2 rounded-full" style={{ width: `${(p.n / maxN) * 100}%`, background: 'var(--brand)' }} />
                </div>
                <span className="w-9 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{p.n}</span>
              </li>
            ))}
            {byPhoneCountry.length === 0 && <li className="text-sm" style={{ color: 'var(--text-faint)' }}>—</li>}
          </ul>
        </div>
      </div>

      {/* 3. Sources des contacts */}
      <div className="kpi-card">
        <SectionHeader title={t.dash.sources} href="/contacts" cta="Voir les contacts" />
        <div className="flex flex-wrap gap-2">
          {sources.map(s => (
            <span key={s.name} className="badge">{s.name} · {s.n}</span>
          ))}
          {sources.length === 0 && <span className="text-sm" style={{ color: 'var(--text-faint)' }}>—</span>}
        </div>
      </div>

      {/* 4. Contacts récents */}
      <div className="kpi-card">
        <SectionHeader title={t.dash.recentContacts} href="/contacts" cta="Voir tout" />
        <table className="data-table">
          <thead><tr><th>Nom</th><th>Entreprise</th><th>Pays</th><th>Ajouté le</th></tr></thead>
          <tbody>
            {recentContacts.map(c => (
              <tr key={c.id}>
                <td><Link href={`/contacts/${c.id}`} className="font-medium hover:underline" style={{ color: 'var(--brand-deep)' }}>{c.fullName || '(sans nom)'}</Link></td>
                <td>{c.company || '—'}</td>
                <td>{c.countryName || '—'}</td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {recentContacts.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-faint)' }}>
                Aucun contact — commencez par un <Link href="/imports/new" className="underline">import CSV</Link>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Imports + exports récents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <SectionHeader title={t.dash.recentImports} href="/imports" cta="Voir tout" />
          <ul className="space-y-2 text-sm">
            {recentImports.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <Link href="/imports" className="truncate hover:underline" style={{ color: 'var(--brand-deep)' }}>{i.file}</Link>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {i.added} ajoutés · {i.skipped} doublons · {i.at.slice(0, 10)}
                </span>
              </li>
            ))}
            {recentImports.length === 0 && <li style={{ color: 'var(--text-faint)' }}>Aucun import</li>}
          </ul>
        </div>
        <div className="kpi-card">
          <SectionHeader title={t.dash.recentExports} href="/exports" cta="Voir tout" />
          <ul className="space-y-2 text-sm">
            {recentExports.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <Link href="/exports" className="truncate hover:underline" style={{ color: 'var(--brand-deep)' }}>
                  Export {e.scope === 'segment' ? 'segment' : e.scope === 'countries' ? 'par pays' : 'base entière'}
                </Link>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {e.rows} lignes · {e.at.slice(0, 10)}
                </span>
              </li>
            ))}
            {recentExports.length === 0 && <li style={{ color: 'var(--text-faint)' }}>Aucun export</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
