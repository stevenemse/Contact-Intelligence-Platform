// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { listContacts, type ContactRow } from '@/lib/supabase/data'
import { contactsFiltersData } from '@/lib/supabase/page-data'
import ContactsTable from '@/components/contacts-table'
import Pager from '@/components/pager'
import ContactsFilters from '@/components/contacts-filters'
import PhoneFixer from '@/components/phone-fixer'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrg()
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string) ?? '')
  const q = one('q').trim()
  const country = one('country')
  const source = one('source')
  const tag = one('tag')
  const phoneValid = one('phoneValid')
  const city = one('city')
  const page = Math.max(1, parseInt(one('page') || '1', 10) || 1)
  const PAGE_SIZE = 25

  const rows0: { rows: ContactRow[]; total: number } = await listContacts(ctx.orgId, {
    q,
    country,
    source,
    tag,
    phoneValid,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })

  // filtre ville (venant de la carte) : appliqué pendant le rendu sur la page courante
  let rows = rows0.rows
  const total = rows0.total
  if (city) {
    rows = rows.filter(r => (r.city ?? '') === city)
  }

  // pour la pagination juste : on relance un count 25 par page suffit via total
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const { countries, sources, tags } = await contactsFiltersData(ctx.orgId)

  const baseQuery: Record<string, string> = { q, country, source, tag, phoneValid, city }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <Link href="/imports/new" className="btn btn-primary">Importer</Link>
          <Link href="/exports/new" className="btn btn-ghost">Exporter</Link>
        </div>
      </div>

      <ContactsFilters
        countries={countries}
        sources={sources}
        tags={tags}
        country={country}
        source={source}
        tag={tag}
        q={q}
        phoneValid={phoneValid}
      />

      {city && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Filtré sur la ville <span className="badge badge-teal">{city}</span>
        </p>
      )}

      <PhoneFixer />

      <ContactsTable rows={rows.map(r => ({
        id: r.id,
        first_name: r.firstName,
        last_name: r.lastName,
        full_name: r.fullName,
        company: r.company,
        job_title: r.jobTitle,
        source: r.source,
        created_at: r.createdAt,
        countryName: r.countryName,
        city: r.city,
        phones: r.phones,
        emails: r.emails,
        tags: r.tags,
      }))} canWrite={canWrite(ctx)} orgId={ctx.orgId} />

      <Pager page={page} totalPages={totalPages} total={total} baseQuery={baseQuery} basePath="/contacts" />
    </div>
  )
}
