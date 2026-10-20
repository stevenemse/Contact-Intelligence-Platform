// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, num } from '@/lib/supabase/helpers'
import ExportBuilderNew from '@/components/export-builder'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function NewExportPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg()
  const sp = await searchParams
  const preselected = ((Array.isArray(sp.segment) ? sp.segment[0] : sp.segment) ?? '')
  const preselectedCountry = /^[A-Za-z]{2}$/.test(preselected) ? preselected.toUpperCase() : ''

  const db = serviceDb()
  let segments: { id: string; name: string }[] = []
  let countries: { iso2: string; name: string; n: number }[] = []
  if (db) {
    const [segRes, cRes] = await Promise.all([
      db.from('segments').select('id, name').eq('organization_id', ctx.orgId).order('name'),
      db.from('contacts').select('country_iso2, country_name')
        .eq('organization_id', ctx.orgId).is('merged_into', null).limit(10000),
    ])
    segments = ((segRes.data ?? []) as unknown as { id: string; name: string | null }[])
      .map(s => ({ id: str(s.id), name: str(s.name) || 'Sans nom' }))
    const counts = new Map<string, { name: string; n: number }>()
    for (const c of ((cRes.data ?? []) as unknown as { country_iso2: string | null; country_name: string | null }[])) {
      const iso = str(c.country_iso2).toUpperCase()
      if (!iso) continue
      const cur = counts.get(iso) ?? { name: str(c.country_name) || iso, n: 0 }
      cur.n++
      counts.set(iso, cur)
    }
    countries = [...counts.entries()].map(([iso2, v]) => ({ iso2, name: v.name, n: v.n }))
      .sort((a, b) => b.n - a.n)
  }
  void num

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <Link href="/exports" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Exports</Link>
        <h1 className="text-2xl font-bold mt-2">Nouvel export</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Choisissez la source, les colonnes, leur ordre, puis générez le CSV UTF-8 (découpe par pays possible).
        </p>
      </div>
      {canWrite(ctx) ? (
        <ExportBuilderNew
          segments={segments}
          countries={countries}
          preselectedCountry={preselectedCountry}
        />
      ) : (
        <div className="glass-card text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Lecture seule — demandez un rôle supérieur à un administrateur.
        </div>
      )}
    </div>
  )
}
