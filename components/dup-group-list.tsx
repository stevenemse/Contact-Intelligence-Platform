'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Contact = {
  fullName?: string | null
  company?: string | null
  jobTitle?: string | null
  source?: string | null
  countryName?: string | null
  city?: string | null
  emails?: { email: string }[] | null
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

  const pending = groups.filter(g => !done.includes(g.normalized_phone))

  async function mergeGroup(phone: string, ids: string[]) {
    if (ids.length < 2) return
    if (!confirm(`Fusionner ${ids.length - 1} contact(s) dans le premier ? Action journalisée.`)) return
    setBusy(true)
    const keeperId = keepMap[phone] ?? ids[0]
    try {
      const res = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keeperId, mergedIds: ids.filter(i => i !== keeperId) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Fusion impossible')
      }
      setDone(prev => [...prev, phone])
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

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
      {pending.map(g => {
        const ids = g.contact_ids
        const keeperId = keepMap[g.normalized_phone] ?? ids[0]
        const open = openId === g.normalized_phone
        return (
          <div key={g.normalized_phone} className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white/90">{g.normalized_phone}</p>
                <p className="text-xs text-[color:var(--text-secondary)]">{g.n} contacts partagent ce numéro</p>
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
                <table className="data-table min-w-[720px] text-sm">
                  <thead>
                    <tr>
                      <th>Conserver</th><th>Nom</th><th>Entreprise</th><th>Fonction</th>
                      <th>Pays</th><th>Ville</th><th>Source</th><th>Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ids.map(id => {
                      const c = contacts[id]
                      if (!c) return null
                      return (
                        <tr key={id}>
                          <td>
                            <input type="radio" name={`keep-${g.normalized_phone}`}
                              checked={keeperId === id}
                              onChange={() => setKeepMap(m => ({ ...m, [g.normalized_phone]: id }))} />
                          </td>
                          <td className="font-medium">{c.fullName ?? '(sans nom)'}</td>
                          <td>{c.company ?? '—'}</td>
                          <td>{c.jobTitle ?? '—'}</td>
                          <td>{c.countryName ?? '—'}</td>
                          <td>{c.city ?? '—'}</td>
                          <td>{c.source ?? '—'}</td>
                          <td>{(c.emails ?? []).map(e => e.email).join(', ') || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-[color:var(--text-secondary)] mt-2">
                  À la fusion : les numéros, emails et tags des contacts absorbés sont transférés sur le conservé,
                  puis le contact absorbé est marqué fusionné (données conservées pour l&apos;audit).
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
