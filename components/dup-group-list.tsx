'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type DupReason = { label: string; points: number; tone: 'positive' | 'warning' }
type DupScore = { score: number; confidence: 'quasi_certain' | 'probable' | 'a_verifier'; reasons: DupReason[] }
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

type Group = { normalized_phone: string; n: number; contact_ids: string[]; score: DupScore }

function label(c: Contact | undefined, phone?: string) {
  return c?.fullName || c?.company || phone || '(fiche sans nom)'
}

export default function DupGroupList({ groups, contacts, canWrite }: {
  groups: Group[]
  contacts: Record<string, Contact>
  canWrite: boolean
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [keepMap, setKeepMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const pending = groups.filter(g => !done.includes(g.normalized_phone))
  const selectedPending = pending.filter(g => selected.includes(g.normalized_phone))
  const allPendingSelected = pending.length > 0 && selectedPending.length === pending.length
  const somePendingSelected = selectedPending.length > 0 && !allPendingSelected

  function companiesOf(ids: string[]) {
    return [...new Set(ids.map(id => (contacts[id]?.company ?? '').trim()).filter(Boolean))]
  }

  function toggleSelected(phone: string) {
    setSelected(current => current.includes(phone)
      ? current.filter(value => value !== phone)
      : [...current, phone])
  }

  function toggleAllPending() {
    setSelected(allPendingSelected ? [] : pending.map(group => group.normalized_phone))
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
    await mergeOne(phone, ids)
  }

  async function mergeOne(phone: string, ids: string[]) {
    const keeperId = keepMap[phone] ?? ids[0]
    setBusy(true)
    try {
      const res = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keeperId, mergedIds: ids.filter(id => id !== keeperId) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Fusion impossible')
      }
      setDone(current => [...current, phone])
      setSelected(current => current.filter(value => value !== phone))
      setNotice('Fusion enregistrée. Les données ont été conservées et journalisées.')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Fusion impossible')
    } finally {
      setBusy(false)
    }
  }

  async function mergeSelected() {
    if (selectedPending.length === 0) return
    const totalAbsorbed = selectedPending.reduce((sum, group) => sum + group.n - 1, 0)
    const ok = confirm(
      `Lancer la fusion de ${selectedPending.length} groupe(s), soit ${totalAbsorbed} fiche(s) absorbée(s) ?\n\n` +
      'Chaque groupe conservera la fiche choisie dans sa ligne. Cette action restera journalisée.'
    )
    if (!ok) return

    setBusy(true)
    let completed = 0
    try {
      for (const group of selectedPending) {
        const keeperId = keepMap[group.normalized_phone] ?? group.contact_ids[0]
        const res = await fetch('/api/duplicates/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keeperId, mergedIds: group.contact_ids.filter(id => id !== keeperId) }),
        })
        if (!res.ok) throw new Error(`Échec pour ${group.normalized_phone}`)
        completed++
        setDone(current => [...current, group.normalized_phone])
      }
      setSelected([])
      setNotice(`${completed} groupe(s) fusionné(s), ${totalAbsorbed} fiche(s) absorbée(s).`)
      router.refresh()
    } catch {
      setNotice(`${completed} groupe(s) fusionné(s). La fusion en masse a été interrompue pour sécuriser les données.`)
    } finally {
      setBusy(false)
    }
  }

  const confidenceLabel = (confidence: DupScore['confidence']) => ({
    quasi_certain: 'Quasi certain', probable: 'Probable', a_verifier: 'À vérifier',
  }[confidence])

  const totalPending = useMemo(
    () => pending.reduce((sum, group) => sum + group.n - 1, 0),
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
      {notice && <p className="text-sm rounded-xl px-3 py-2" style={{ background: 'var(--success-soft, rgba(16,185,129,.12))', color: 'var(--success)' }}>{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pending.length} groupe(s) · {totalPending} fiche(s) en trop. Analysez puis sélectionnez les groupes à traiter.</p>
          {canWrite && <label className={`check-row ${allPendingSelected || somePendingSelected ? 'is-selected' : ''}`} style={{ padding: '5px 9px', margin: 0 }}>
            <input
              type="checkbox"
              aria-label="Sélectionner tous les groupes de doublons"
              checked={allPendingSelected}
              ref={(element) => { if (element) element.indeterminate = somePendingSelected }}
              onChange={toggleAllPending}
            />
            <span className="check-body"><span className="check-title">Tout sélectionner</span></span>
          </label>}
        </div>
        {canWrite && selectedPending.length > 0 && <button onClick={mergeSelected} disabled={busy} className="btn btn-primary text-xs">{busy ? 'Fusion en cours…' : `Fusionner ${selectedPending.length} groupe(s)`}</button>}
      </div>

      {pending.map(group => {
        const ids = group.contact_ids
        const keeperId = keepMap[group.normalized_phone] ?? ids[0]
        const open = openId === group.normalized_phone
        const companies = companiesOf(ids)
        return (
          <div key={group.normalized_phone} className="glass-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {canWrite && <input type="checkbox" aria-label={`Sélectionner le groupe ${group.normalized_phone}`} checked={selected.includes(group.normalized_phone)} onChange={() => toggleSelected(group.normalized_phone)} className="mt-1" />}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold tabular-nums text-[color:var(--text-primary)]">{group.normalized_phone}</p>
                    <span className="badge" style={{ color: group.score.confidence === 'quasi_certain' ? 'var(--success)' : group.score.confidence === 'probable' ? 'var(--warning)' : 'var(--text-secondary)' }}>{group.score.score}/100 · {confidenceLabel(group.score.confidence)}</span>
                  </div>
                  <p className="text-xs text-[color:var(--text-secondary)]">{group.n} fiches partagent ce numéro{companies.length > 0 && ` · ${companies.join(' · ')}`}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpenId(open ? null : group.normalized_phone)} className="btn btn-ghost text-xs">{open ? 'Réduire' : 'Comparer'}</button>
                {canWrite && open && <button onClick={() => mergeGroup(group.normalized_phone, ids)} disabled={busy} className="btn btn-primary text-xs">Fusionner</button>}
              </div>
            </div>

            {open && <div className="mt-4 space-y-3">
              <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--surface-muted, rgba(148,163,184,.10))', color: 'var(--text-secondary)' }}><strong>Pourquoi ce rapprochement ?</strong><span className="ml-2">{group.score.reasons.map(reason => `${reason.label} (${reason.points > 0 ? '+' : ''}${reason.points})`).join(' · ')}</span></div>
              <div className="overflow-x-auto"><table className="data-table min-w-[980px] text-sm"><thead><tr><th>Conserver</th><th>Nom</th><th>Téléphone(s)</th><th>Entreprise</th><th>Fonction</th><th>Groupes</th><th>Pays</th><th>Source</th><th>Emails</th></tr></thead><tbody>
                {ids.map(id => {
                  const contact = contacts[id]
                  if (!contact) return null
                  const phones = contact.phones ?? []
                  return <tr key={id} style={keeperId === id ? { background: 'rgba(13,148,136,.06)' } : undefined}>
                    <td><input type="radio" name={`keep-${group.normalized_phone}`} aria-label={`Conserver ${label(contact)}`} checked={keeperId === id} onChange={() => setKeepMap(map => ({ ...map, [group.normalized_phone]: id }))} /></td>
                    <td className="font-medium">{contact.fullName || <span style={{ color: 'var(--text-muted)' }}>(sans nom)</span>}</td>
                    <td className="tabular-nums">{phones.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>—</span> : <span className="flex flex-col gap-0.5">{phones.map((phone, index) => <span key={`${id}-${index}`} className="whitespace-nowrap">{phone.phone}{phone.isPrimary && phones.length > 1 && <span className="badge badge-blue ml-1">principal</span>}{!phone.isValid && <span className="text-xs ml-1" style={{ color: 'var(--danger)' }}>invalide</span>}</span>)}</span>}</td>
                    <td>{contact.company ?? '—'}</td><td>{contact.jobTitle ?? '—'}</td>
                    <td>{(contact.tags ?? []).length === 0 ? <span style={{ color: 'var(--text-muted)' }}>—</span> : <span className="flex flex-wrap gap-1">{(contact.tags ?? []).map(tag => <span key={tag.name} className="badge" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.name}</span>)}</span>}</td>
                    <td>{contact.countryName ?? '—'}</td><td>{contact.source ?? '—'}</td><td>{(contact.emails ?? []).map(email => email.email).join(', ') || '—'}</td>
                  </tr>
                })}
              </tbody></table></div>
              <p className="text-xs text-[color:var(--text-secondary)]">Fiche conservée : <strong>{label(contacts[keeperId], group.normalized_phone)}</strong>{companies.length > 0 && <> · entreprises gardées : {companies.join(', ')}</>} — les données des fiches absorbées sont transférées et journalisées.</p>
              <p className="text-xs" style={{ color: 'var(--warning)' }}>La fusion reste entièrement manuelle : vérifiez les divergences avant de confirmer.</p>
            </div>}
          </div>
        )
      })}
    </div>
  )
}
