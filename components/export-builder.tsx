'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ALL_COLUMNS = [
  { key: 'full_name', label: 'Nom complet' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'last_name', label: 'Nom' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'country', label: 'Pays' },
  { key: 'region', label: 'Région' },
  { key: 'city', label: 'Ville' },
  { key: 'company', label: 'Entreprise' },
  { key: 'job_title', label: 'Fonction' },
  { key: 'source', label: 'Source' },
  { key: 'tags', label: 'Tags' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: "Date d'ajout" },
]

const DEFAULT_COLS = ['full_name', 'phone', 'email', 'country', 'city', 'company']

export default function ExportBuilderNew({ segments, countries, preselectedCountry }: {
  segments: { id: string; name: string }[]
  countries: { iso2: string; name: string; n: number }[]
  preselectedCountry: string
}) {
  const router = useRouter()
  const [scope, setScope] = useState<'all' | 'segment' | 'countries'>('all')
  const [segmentId, setSegmentId] = useState('')
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    preselectedCountry ? [preselectedCountry] : []
  )
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS)
  const [splitByCountry, setSplitByCountry] = useState(false)
  const [onlyUnique, setOnlyUnique] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function moveCol(k: string, dir: -1 | 1) {
    setCols(c => {
      const i = c.indexOf(k)
      const j = i + dir
      if (i < 0 || j < 0 || j >= c.length) return c
      const next = [...c]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function runExport() {
    setBusy(true); setMessage(null)
    try {
      const res = await fetch('/api/exports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          segmentId: scope === 'segment' ? segmentId : undefined,
          countries: scope === 'countries' ? selectedCountries : undefined,
          splitByCountry: scope === 'countries' ? true : splitByCountry,
          columns: cols,
          onlyUnique,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur export')
      setMessage(`Export lancé — ${json.totalRows ?? '?'} ligne(s). ${json.files ? json.files.length + ' fichier(s) prêt(s).' : ''}`)
      if (Array.isArray(json.files)) {
        for (const f of json.files) {
          const a = document.createElement('a')
          a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(f.content)
          a.download = f.name
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
      }
      router.refresh()
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setBusy(false)
    }
  }

  const canRun =
    (scope === 'all') ||
    (scope === 'segment' && segmentId !== '') ||
    (scope === 'countries' && selectedCountries.length > 0)

  return (
    <div className="space-y-4">
      <div className="glass-card space-y-4">
        <div>
          <h3 className="section-title mb-2">1. Source des données</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { k: 'all', label: 'Base entière' },
              { k: 'segment', label: 'Un segment' },
              { k: 'countries', label: 'Par pays' },
            ].map(o => (
              <button key={o.k} onClick={() => setScope(o.k as typeof scope)}
                className={`btn justify-center ${scope === o.k ? 'btn-primary' : 'btn-ghost'}`}>{o.label}</button>
            ))}
          </div>
          {scope === 'segment' && (
            <select className="input mt-3" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">— choisir un segment —</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {scope === 'countries' && (
            <div className="mt-3 max-h-56 overflow-y-auto border border-white/10 rounded-xl p-2 space-y-1">
              {countries.map(c => (
                <label key={c.iso2} className="flex items-center gap-2 text-sm px-1 py-0.5 text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={selectedCountries.includes(c.iso2)}
                    onChange={() => setSelectedCountries(s =>
                      s.includes(c.iso2) ? s.filter(x => x !== c.iso2) : [...s, c.iso2])} />
                  <span className="flex-1">{c.name}</span>
                  <span className="badge">{c.n}</span>
                </label>
              ))}
            </div>
          )}
          {scope === 'all' && (
            <label className="flex items-center gap-3 text-sm mt-3 text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={splitByCountry} onChange={(e) => setSplitByCountry(e.target.checked)} />
              Générer un fichier distinct par pays
            </label>
          )}
        </div>

        <div>
          <h3 className="section-title mb-2">2. Colonnes et ordre</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[color:var(--text-muted)] mb-1">Sélection</p>
              <div className="border border-white/10 rounded-xl p-2 max-h-56 overflow-y-auto space-y-0.5">
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-sm px-1 text-[color:var(--text-secondary)]">
                    <input type="checkbox" checked={cols.includes(c.key)}
                      onChange={() => {
                        setCols(prev => prev.includes(c.key) ? prev.filter(x => x !== c.key) : [...prev, c.key])
                      }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--text-muted)] mb-1">Ordre des colonnes</p>
              <ul className="border border-white/10 rounded-xl p-2 space-y-1">
                {cols.map((k, i) => (
                  <li key={k} className="flex items-center gap-2 text-sm bg-[color:var(--bg-sunken)] rounded px-2 py-1 text-[color:var(--text-secondary)]">
                    <span className="flex-1">{ALL_COLUMNS.find(c => c.key === k)?.label}</span>
                    <button onClick={() => moveCol(k, -1)} className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] px-1">↑</button>
                    <button onClick={() => moveCol(k, 1)} className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] px-1">↓</button>
                  </li>
                ))}
                {cols.length === 0 && <li className="text-xs text-[color:var(--text-secondary)]">Aucune colonne sélectionnée</li>}
              </ul>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm mt-3 text-[color:var(--text-secondary)]">
            <input type="checkbox" checked={onlyUnique} onChange={(e) => setOnlyUnique(e.target.checked)} />
            Exporter uniquement les contacts uniques (sans les fusionnés)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={runExport} disabled={busy || !canRun || cols.length === 0}
            className="btn btn-primary">
            {busy ? 'Génération...' : 'Générer le CSV'}
          </button>
          {message && <span className="text-sm text-[color:var(--text-muted)]">{message}</span>}
        </div>
      </div>

      <p className="text-xs text-[color:var(--text-secondary)]">
        Encodage CSV UTF-8. Les numéros sont exportés au format international normalisé, la donnée brute reste en base.
      </p>
    </div>
  )
}
