'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ContactEditor({ orgId: _orgId, contact, canWrite, countries, cities }: {
  orgId: string
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    company: string | null
    job_title: string | null
    source: string | null
    notes: string | null
    country_id: string | null
    city_id: string | null
  }
  canWrite: boolean
  countries: { id: string; name_fr: string }[]
  cities: { id: string; name: string }[]
}) {
  void _orgId
  const router = useRouter()
  const [f, setF] = useState({ ...contact })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: string, v: string) {
    setSaved(false)
    setF(prev => ({ ...prev, [k]: v || null }))
  }

  async function save() {
    setSaving(true); setError(null)
    const full = [f.first_name, f.last_name].filter(Boolean).join(' ') || null
    try {
      // le pays est traduit en iso2 + nom pour la cohérence en base
      const country = countries.find(c => c.id === f.country_id)
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: f.first_name ?? null,
          last_name: f.last_name ?? null,
          full_name: full,
          company: f.company ?? null,
          job_title: f.job_title ?? null,
          source: f.source ?? null,
          notes: f.notes ?? null,
          country_iso2: country?.id ?? null,
          country_name: country?.name_fr ?? null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Erreur de sauvegarde (vérifiez la configuration Supabase)')
      }
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
    setSaving(false)
  }

  const readOnly = !canWrite

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Informations générales</h3>
        {saved && <span className="badge badge-green">Enregistré</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Prénom</label>
          <input className="input mt-1" disabled={readOnly} value={f.first_name ?? ''}
            onChange={(e) => set('first_name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Nom</label>
          <input className="input mt-1" disabled={readOnly} value={f.last_name ?? ''}
            onChange={(e) => set('last_name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Entreprise</label>
          <input className="input mt-1" disabled={readOnly} value={f.company ?? ''}
            onChange={(e) => set('company', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Fonction</label>
          <input className="input mt-1" disabled={readOnly} value={f.job_title ?? ''}
            onChange={(e) => set('job_title', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Pays</label>
          <select className="input mt-1" disabled={readOnly} value={f.country_id ?? ''}
            onChange={(e) => set('country_id', e.target.value)}>
            <option value="">—</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Ville (donnée uniquement si présente dans vos données)</label>
          {/* non éditable : la ville n'est jamais déduite automatiquement */}
          <select className="input mt-1" disabled value={f.city_id ?? ''}>
            <option value="">—</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">Source</label>
          <input className="input mt-1" disabled={readOnly} value={f.source ?? ''}
            onChange={(e) => set('source', e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <label className="text-xs font-medium text-[color:var(--text-secondary)]">Notes internes</label>
        <textarea className="input mt-1" rows={3} disabled={readOnly} value={f.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)} />
      </div>
      {error && <p className="mt-2 text-sm text-[color:var(--danger)]">{error}</p>}
      {!readOnly && (
        <button onClick={save} disabled={saving}
          className="btn btn-primary mt-4">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      )}
    </div>
  )
}
