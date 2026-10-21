// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str } from '@/lib/supabase/helpers'
import { segmentBuilderData, effectiveCountryData } from '@/lib/supabase/page-data'
import ExportBuilder from '@/components/export-builder'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function NewExportPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg()
  const sp = await searchParams
  const wanted = ((Array.isArray(sp.segment) ? sp.segment[0] : sp.segment) ?? '')

  const db = serviceDb()
  let segments: { id: string; name: string; rules: unknown }[] = []
  let totalContacts = 0
  if (db) {
    const [segRes, totalRes] = await Promise.all([
      db.from('segments').select('id, name, rules').eq('organization_id', ctx.orgId).order('name'),
      db.from('contacts').select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.orgId).is('merged_into', null),
    ])
    segments = ((segRes.data ?? []) as unknown as { id: string; name: string | null; rules: unknown }[])
      .map(s => ({ id: str(s.id), name: str(s.name) || 'Sans nom', rules: s.rules }))
    totalContacts = totalRes.count ?? 0
  }

  // pays réellement présents (country_iso2 ou indicatif du téléphone principal)
  const { countries } = await effectiveCountryData(ctx.orgId)

  // listes de valeurs réelles pour créer un segment sans quitter l'export
  const filters = await segmentBuilderData(ctx.orgId)
  const preselectedSegment = segments.some(s => s.id === wanted) ? wanted : ''
  const preselectedCountry = !preselectedSegment && /^[A-Za-z]{2}$/.test(wanted) ? wanted.toUpperCase() : ''

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <Link href="/exports" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Exports</Link>
        <h1 className="text-2xl font-bold mt-2">Nouvel export</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Choisissez qui exporter, les colonnes et leur ordre — le CSV se génère ensuite en un clic.
        </p>
      </div>
      {canWrite(ctx) ? (
        <ExportBuilder
          segments={segments}
          countries={countries}
          totalContacts={totalContacts}
          preselectedSegment={preselectedSegment}
          preselectedCountry={preselectedCountry}
          filters={{
            tags: filters.tags,
            sources: filters.sources,
            cities: filters.cities,
            countries: filters.countries,
          }}
          orgId={ctx.orgId}
        />
      ) : (
        <div className="glass-card text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Lecture seule — demandez un rôle supérieur à un administrateur.
        </div>
      )}
    </div>
  )
}
