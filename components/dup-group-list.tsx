'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Contact = {
  fullName?: string | null
  company?: string | null
  jobTitle?: string | null
  source?: string | null
  countryName?: string | null
  city?: string | null
  phones?: { phone: string; isPrimary: boolean; isValid: boolean }[] | null
  tags?: { name: string; color: string }[] | null
  emails?: { email: string }[] | null
}

/** Les fiches importées ont souvent ni nom ni prénom : on retombe sur l'entreprise puis le numéro. */
function label(c: Contact | undefined, phone?: string) {
  return c?.fullName || c?.company || phone || '(fiche sans nom)'
}

export default function DupGroupList({ groups, contacts, canWrite }: {
  groups: { normalized_phone: string; n: number; contact_ids: string[] }[]
  contacts: Record<string, Contact>
  canWrite: boolean
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [keepMap, setKeepMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const pending = groups.filter(g => !done.includes(g.normalized_phone))

  function companiesOf(ids: string[]) {
    return [...new Set(ids.map(id => (contacts[id]?.company ?? '').trim()).filter(Boolean))]
  }

  async function mergeGroup(phone: string, ids: string[]) {
    if (ids.length < 2) return
    const keeperId = keepMap[phone] ?? ids[0]
    const companies = companiesOf(ids)
    const ok = confirm(
      `Fusionner ${ids.length - 1} fiche(s) dans « ${label(contacts[keeperId], phone)} » ?\n\n` +
      `Entreprises / groupes conservés : ${companies.join(', ') || '—'}\n\n` +
      'Les numéros, emails, entreprises et tags des fiches absorbées sont conservés sur la fiche gardée.'
    )
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keeperId, mergedIds: ids.filter(i => i !== keeperId) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Fusion impossible')
        return
      }
      setDone(prev => [...prev, phone])
      setNotice(
        companies.length > 1
          ? `Fusion enregistrée. Entreprises conservées : ${companies.join(', ')}.`
          : 'Fusion enregistrée.'
      )
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const totalPending = useMemo(
    () => pending.reduce((acc, g) => acc + g.n - 1, 0),
    [pending]
  )

  if (pending.length === 0) {
    return (
      <div className="glass-card text-center py-10">
        <p className="text-lg font-semibold text-[color:var(--success)]">Aucun doublon en attente</p>
        <p className="text-sm text-[color:var(--text-secondary)] mt-1">Les fusions passées restent consultables dans l&apos;historique d&apos;activité.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p className="text-sm rounded-xl px-3 py-2" style={{ background: 'var(--success-soft, rgba(16,185,129,.12))', color: 'var(--success)' }}>
          {notice}
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {pending.length} groupe(s) · {totalPending} fiche(s) en trop. Ouvrez un groupe pour comparer les fiches (numéros, entreprises, groupes) avant de fusionner.
      </p>

      {pending.map(g => {
        const ids = g.contact_ids
        const keeperId = keepMap[g.normalized_phone] ?? ids[0]
        const open = openId === g.normalized_phone
        const companies = companiesOf(ids)
        return (
          <div key={g.normalized_phone} className="glass-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold tabular-nums text-[color:var(--text-primary)]">{g.normalized_phone}</p>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  {g.n} fiches partagent ce numéro
                  {companies.length > 0 && ` · ${companies.join(' · ')}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpenId(open ? null : g.normalized_phone)} className="btn btn-ghost text-xs">
                  {open ? 'Réduire' : 'Comparer'}
                </button>
                {canWrite && open && (
                  <button onClick={() => mergeGroup(g.normalized_phone, ids)} disabled={busy}
                    className="btn btn-primary text-xs">Fusionner</button>
                )}
              </div>
            </div>

            {open && (
              <div className="mt-4 overflow-x-auto">
                <table className="data-table min-w-[980px] text-sm">
                  <thead>
                    <tr>
                      <th>Conserver</th><th>Nom</th><th>Téléphone(s)</th><th>Entreprise</th>
                      <th>Fonction</th><th>Groupes</th><th>Pays</th><th>Source</th><th>Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ids.map(id => {
                      const c = contacts[id]
                      if (!c) return null
                      const phones = c.phones ?? []
                      return (
                        <tr key={id} style={keeperId === id ? { background: 'rgba(13,148,136,.06)' } : undefined}>
                          <td>
                            <input type="radio" name={`keep-${g.normalized_phone}`}
                              checked={keeperId === id}
                              onChange={() => setKeepMap(m => ({ ...m, [g.normalized_phone]: id }))} />
                          </td>
                          <td className="font-medium">
                            {c.fullName || <span style={{ color: 'var(--text-muted)' }}>(sans nom)</span>}
                          </td>
                          <td className="tabular-nums">
                            {phones.length === 0
                              ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                              : (
                                <span className="flex flex-col gap-0.5">
                                  {phones.map((p, i) => (
                                    <span key={`${id}-${i}`} className="whitespace-nowrap">
                                      {p.phone}
                                      {p.isPrimary && phones.length > 1 && <span className="badge badge-blue ml-1">principal</span>}
                                      {!p.isValid && <span className="text-xs ml-1" style={{ color: 'var(--danger)' }}>invalide</span>}
                                    </span>
                                  ))}
                                </span>
                              )}
                          </td>
                          <td>{c.company ?? '—'}</td>
                          <td>{c.jobTitle ?? '—'}</td>
                          <td>
                            {(c.tags ?? []).length === 0
                              ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                              : (
                                <span className="flex flex-wrap gap-1">
                                  {(c.tags ?? []).map(t => (
                                    <span key={t.name} className="badge" style={{ background: `${t.color}22`, color: t.color }}>
                                      {t.name}
                                    </span>
                                  ))}
                                </span>
                              )}
                          </td>
                          <td>{c.countryName ?? '—'}</td>
                          <td>{c.source ?? '—'}</td>
                          <td>{(c.emails ?? []).map(e => e.email).join(', ') || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-[color:var(--text-secondary)] mt-2">
                  Fiche conservée : <strong>{label(contacts[keeperId], g.normalized_phone)}</strong>
                  {companies.length > 0 && <> · entreprises gardées : {companies.join(', ')}</>}
                  {' '}— les numéros, emails, entreprises et groupes des fiches absorbées sont transférés
                  (aucune donnée d&apos;analyse perdue, la fiche absorbée reste consultable).
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
