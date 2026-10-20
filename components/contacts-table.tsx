'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company: string | null
  job_title: string | null
  source: string | null
  created_at: string
  countryIso2?: string | null
  countryName?: string | null
  city?: string | null
  phones?: { normalizedPhone: string | null; rawPhone: string; isValid: boolean; isPrimary: boolean }[] | null
  emails?: { email: string; isPrimary: boolean }[] | null
  tags?: { id: string; name: string; color: string }[] | null
}

export default function ContactsTable({ rows, canWrite, orgId: _orgId }: { rows: Row[]; canWrite: boolean; orgId: string }) {
  void _orgId
  const router = useRouter()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const allChecked = rows.length > 0 && rows.every(r => sel.has(r.id))

  function toggleAll() {
    setSel(allChecked ? new Set() : new Set(rows.map(r => r.id)))
  }

  function toggle(id: string) {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSel(next)
  }

  async function deleteSelected() {
    if (sel.size === 0) return
    if (!confirm(`Supprimer ${sel.size} contact(s) ? Action journalisée.`)) return
    setBusy(true)
    const res = await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: { ids: [...sel] } }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'Suppression impossible')
      return
    }
    setSel(new Set())
    router.refresh()
  }

  return (
    <div className="kpi-card">
      {canWrite && (
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <button onClick={toggleAll} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>
            {allChecked ? 'Déselectionner tout' : 'Tout sélectionner'}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{sel.size} sélectionné(s)</span>
          <button onClick={deleteSelected} disabled={busy || sel.size === 0}
            className="btn btn-danger text-xs py-1.5 ml-auto">
            Supprimer la sélection
          </button>
        </div>
      )}
      <div style={{ overflowX: 'auto', marginTop: canWrite ? 12 : 0 }}>
      <table className="data-table" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th className="w-8"></th>
            <th>Nom</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Pays</th>
            <th>Ville</th>
            <th>Entreprise</th>
            <th>Source</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>Aucun contact</td></tr>
          )}
          {rows.map(r => {
            const primary = (r.phones ?? []).find(p => p.isPrimary) ?? r.phones?.[0]
            const valid = primary?.isValid
            const email = (r.emails ?? []).find(e => e.isPrimary) ?? r.emails?.[0]
            const name = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '(sans nom)'
            return (
              <tr key={r.id} className={sel.has(r.id) ? 'Table-selected' : ''}>
                <td>
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td>
                  <Link href={`/contacts/${r.id}`} className="font-medium hover:underline" style={{ color: 'var(--brand-deep)' }}>{name}</Link>
                  {r.job_title && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.job_title}</div>}
                </td>
                <td className="whitespace-nowrap">
                  {primary ? (
                    <span>
                      {primary.normalizedPhone ?? primary.rawPhone}
                      <span className="ml-1.5 inline-block w-2 h-2 rounded-full" style={{ background: valid ? 'var(--success)' : 'var(--danger)' }}
                        title={valid ? 'Numéro valide' : 'Numéro invalide'} />
                    </span>
                  ) : '—'}
                </td>
                <td>{email?.email ?? '—'}</td>
                <td>{r.countryName ?? '—'}</td>
                <td>{r.city ?? '—'}</td>
                <td>{r.company ?? '—'}</td>
                <td>{r.source ? <span className="badge">{r.source}</span> : '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(r.tags ?? []).map((t, i) =>
                      t ? <span key={i} className="badge badge-teal">{t.name}</span> : null
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
