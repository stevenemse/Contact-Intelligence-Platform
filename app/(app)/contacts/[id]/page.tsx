// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, num } from '@/lib/supabase/helpers'
import { COUNTRY_NAMES, fmtDate } from '@/lib/supabase/page-data'
import { loadRelations } from '@/lib/supabase/data'
import ContactDetail from '@/components/contact-detail'
import ContactEditor from '@/components/contact-editor'

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Prénom', last_name: 'Nom', full_name: 'Nom complet', company: 'Entreprise',
  job_title: 'Fonction', source: 'Source', notes: 'Notes', country_iso2: 'Pays', country_name: 'Pays',
  fusion_entreprises: 'Entreprises fusionnées', fusion_fonctions: 'Fonctions fusionnées',
  fusion_fiches: 'Fiches fusionnées',
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg()
  const { id } = await params
  const db = serviceDb()
  if (!db) notFound()

  const { data: contactRaw } = await db!.from('contacts').select('*')
    .eq('organization_id', ctx.orgId).eq('id', id).maybeSingle()
  if (!contactRaw) notFound()
  const contact = contactRaw as unknown as Record<string, unknown>

  const canEdit = canWrite(ctx)

  // relations complètes pour l'affichage
  const rel = await loadRelations(ctx.orgId, [id])
  const phones = rel.phonesById.get(id) ?? []
  const emails = rel.emailsById.get(id) ?? []
  const tags = rel.tagsById.get(id) ?? []

  // tags disponibles
  const { data: tagRows } = await db!.from('tags').select('id, name, color')
    .eq('organization_id', ctx.orgId).order('name')
  const tagList = ((tagRows ?? []) as unknown as { id: string; name: string | null; color: string | null }[])
    .map(t => ({ id: t.id, name: str(t.name), color: str(t.color) || '#2563eb' }))
  const currentTags = tags.map(t => ({ tag_id: t.id, tags: { name: t.name, color: t.color } }))

  // historique des modifications (colonne jsonb `fields`, horodatage `changed_at`)
  let changes: { id: string; label: string; at: string }[] = []
  try {
    const { data: ch } = await db!.from('contact_changes').select('*')
      .eq('organization_id', ctx.orgId).eq('contact_id', id)
      .order('changed_at', { ascending: false }).limit(30)
    changes = ((ch ?? []) as unknown as Record<string, unknown>[]).flatMap(r => {
      const fields = (r.fields ?? {}) as Record<string, unknown>
      const parts = Object.entries(fields)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => {
          const name = FIELD_LABELS[k] ?? k
          return k.startsWith('fusion_') ? `${name} : ${String(v)}` : `${name} (avant) : ${String(v)}`
        })
      if (parts.length === 0) return []
      return [{ id: str(r.id), label: parts.join(' · '), at: fmtDate(str(r.changed_at)) }]
    })
  } catch { /* table optionnelle */ }

  // fiches absorbées lors d'une fusion : rien n'est perdu, tout reste consultable
  const { data: mergedRows } = await db!.from('contacts')
    .select('id, full_name, first_name, last_name, company, job_title, updated_at')
    .eq('organization_id', ctx.orgId).eq('merged_into', id).limit(30)
  const mergedRaw = ((mergedRows ?? []) as unknown as Record<string, unknown>[])
  const mergedRel = mergedRaw.length
    ? await loadRelations(ctx.orgId, mergedRaw.map(r => str(r.id)))
    : null
  const mergedFrom = mergedRaw.map(r => {
    const mid = str(r.id)
    const phoneList = mergedRel?.phonesById.get(mid) ?? []
    const mainPhone = phoneList.find(p => p.isPrimary) ?? phoneList[0]
    return {
      id: mid,
      name: str(r.full_name) || [str(r.first_name), str(r.last_name)].filter(Boolean).join(' ') || '(sans nom)',
      company: str(r.company),
      jobTitle: str(r.job_title),
      phone: mainPhone?.normalizedPhone ?? mainPhone?.rawPhone ?? '',
      at: fmtDate(str(r.updated_at)),
    }
  })
  const mergedCompanies = [...new Set(mergedFrom.map(m => m.company).filter(Boolean))]

  // import d'origine
  const importId = str(contact.import_id)
  let importInfo: { file: string; at: string } | null = null
  if (importId) {
    const { data: imp } = await db!.from('import_batches').select('file_name, created_at')
      .eq('id', importId).maybeSingle()
    if (imp) importInfo = { file: str((imp as unknown as Record<string, unknown>).file_name), at: fmtDate(str((imp as unknown as Record<string, unknown>).created_at)) }
  }

  // doublons potentiels : même téléphone normalisé ou même email
  const dupIds = new Set<string>()
  const primary = phones.find(p => p.isPrimary) ?? phones[0]
  if (primary?.normalizedPhone) {
    const { data } = await db!.from('contact_phones').select('contact_id')
      .eq('organization_id', ctx.orgId).eq('normalized_phone', primary.normalizedPhone)
      .neq('contact_id', id).limit(20)
    for (const r of ((data ?? []) as unknown as { contact_id: string }[])) dupIds.add(str(r.contact_id))
  }
  const primaryEmail = emails.find(e => e.isPrimary) ?? emails[0]
  if (primaryEmail) {
    const { data } = await db!.from('contact_emails').select('contact_id')
      .eq('organization_id', ctx.orgId).eq('email', primaryEmail.email)
      .neq('contact_id', id).limit(20)
    for (const r of ((data ?? []) as unknown as { contact_id: string }[])) dupIds.add(str(r.contact_id))
  }
  let dupList: { id: string; name: string; company: string }[] = []
  if (dupIds.size) {
    const { data } = await db!.from('contacts').select('id, full_name, first_name, last_name, company')
      .eq('organization_id', ctx.orgId).in('id', [...dupIds]).limit(10)
    dupList = ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
      id: str(r.id),
      name: str(r.full_name) || [str(r.first_name), str(r.last_name)].filter(Boolean).join(' ') || '(sans nom)',
      company: str(r.company),
    }))
  }

  // listes pour l'éditeur
  let countries: { id: string; name_fr: string }[] = []
  try {
    const { data } = await db!.from('countries').select('id, name_fr').limit(300)
    countries = ((data ?? []) as unknown as { id: string; name_fr: string | null }[]).map(c => ({ id: str(c.id), name_fr: str(c.name_fr) || str(c.id) }))
  } catch { /* table optionnelle */ }
  if (countries.length === 0) {
    countries = Object.entries(COUNTRY_NAMES).map(([cid, name]) => ({ id: cid, name_fr: name }))
  }
  const cities = contact.city ? [{ id: str(contact.city), name: str(contact.city) }] : []

  const fullName = str(contact.full_name) || [str(contact.first_name), str(contact.last_name)].filter(Boolean).join(' ') || '(sans nom)'

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link href="/contacts" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Tous les contacts</Link>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {str(contact.company) || '—'} · {str(contact.country_name) || '—'} {str(contact.city) ? `· ${str(contact.city)}` : ''} ·
              {' '}ajouté le {fmtDate(str(contact.created_at))}
            </p>
            {mergedFrom.length > 0 && (
              <p className="text-xs mt-2 flex flex-wrap items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span>Entreprises fusionnées :</span>
                {mergedCompanies.length === 0
                  ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                  : mergedCompanies.map(c => <span key={c} className="badge">{c}</span>)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {importInfo && <span className="badge">importé via {importInfo.file}</span>}
            {str(contact.merged_into) && <span className="badge badge-red">fusionné</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ContactEditor
          orgId={ctx.orgId}
          contact={{
            id,
            first_name: contact.first_name as string | null,
            last_name: contact.last_name as string | null,
            full_name: contact.full_name as string | null,
            company: contact.company as string | null,
            job_title: contact.job_title as string | null,
            source: contact.source as string | null,
            notes: contact.notes as string | null,
            country_id: str(contact.country_iso2).toUpperCase() || null,
            city_id: contact.city ? str(contact.city) : null,
          }}
          canWrite={canEdit}
          countries={countries}
          cities={cities}
        />
        <ContactDetail
          orgId={ctx.orgId}
          contactId={id}
          phones={phones}
          emails={emails}
          tagList={tagList}
          currentTags={currentTags}
        />
      </div>

      {mergedFrom.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title mb-1">Fiches fusionnées ({mergedFrom.length})</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Ces fiches ont été absorbées : leurs entreprises, fonctions, numéros et groupes sont conservés et restent consultables.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-sm">
              <thead>
                <tr><th>Fiche</th><th>Entreprise</th><th>Fonction</th><th>Téléphone</th><th>Fusionnée le</th></tr>
              </thead>
              <tbody>
                {mergedFrom.map(m => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/contacts/${m.id}`} className="hover:underline" style={{ color: 'var(--brand-deep)' }}>{m.name}</Link>
                    </td>
                    <td>{m.company || '—'}</td>
                    <td>{m.jobTitle || '—'}</td>
                    <td className="tabular-nums">{m.phone || '—'}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="kpi-card">
          <h3 className="section-title mb-3">Doublons potentiels ({dupList.length})</h3>
          <ul className="space-y-2 text-sm">
            {dupList.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <Link href={`/contacts/${d.id}`} className="hover:underline" style={{ color: 'var(--brand-deep)' }}>{d.name}</Link>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.company || '—'}</span>
              </li>
            ))}
            {dupList.length === 0 && <li style={{ color: 'var(--text-faint)' }}>Aucun doublon détecté</li>}
          </ul>
        </div>
        <div className="kpi-card">
          <h3 className="section-title mb-3">Historique des modifications</h3>
          <ul className="space-y-2 text-sm">
            {changes.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{c.label}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{c.at}</span>
              </li>
            ))}
            {changes.length === 0 && <li style={{ color: 'var(--text-faint)' }}>Aucune modification enregistrée</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

void num
