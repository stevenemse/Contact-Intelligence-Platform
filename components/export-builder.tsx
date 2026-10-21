'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SegmentBuilder, { type SegmentGroup } from '@/components/segment-builder'

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

type Scope = 'all' | 'segment' | 'countries'
type SegmentOption = { id: string; name: string; rules: unknown }
type Message = { tone: 'ok' | 'error'; text: string } | null

const SCOPES: { key: Scope; label: string; desc: string }[] = [
  { key: 'all', label: 'Toute la base', desc: 'Tous les contacts actifs de votre espace.' },
  { key: 'segment', label: 'Un segment', desc: 'Un filtre sauvegardé, ou créé à la volée.' },
  { key: 'countries', label: 'Des pays', desc: 'Une ou plusieurs zones géographiques.' },
]

export default function ExportBuilder({
  segments,
  countries,
  totalContacts,
  preselectedSegment,
  preselectedCountry,
  filters,
  orgId,
}: {
  segments: SegmentOption[]
  countries: { iso2: string; name: string; n: number }[]
  totalContacts: number
  preselectedSegment: string
  preselectedCountry: string
  filters: { tags: string[]; sources: string[]; cities: string[]; countries: { iso2: string; name: string }[] }
  orgId: string
}) {
  const router = useRouter()

  const [scope, setScope] = useState<Scope>(
    preselectedSegment ? 'segment' : preselectedCountry ? 'countries' : 'all'
  )
  const [segmentList, setSegmentList] = useState<SegmentOption[]>(segments)
  const [segmentId, setSegmentId] = useState(preselectedSegment)
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({})
  const [countLoading, setCountLoading] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    preselectedCountry ? [preselectedCountry] : []
  )
  const [countryQuery, setCountryQuery] = useState('')
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS)
  const [splitByCountry, setSplitByCountry] = useState(Boolean(preselectedCountry))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  // ── estimation du nombre de contacts du segment choisi ──
  useEffect(() => {
    if (scope !== 'segment' || !segmentId) return
    const seg = segmentList.find(s => s.id === segmentId)
    if (!seg) return
    let cancelled = false
    setCountLoading(true)
    fetch('/api/segments/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: Array.isArray(seg.rules) ? seg.rules : [] }),
    })
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (cancelled || !ok || typeof json.count !== 'number') return
        setSegmentCounts(m => ({ ...m, [segmentId]: json.count as number }))
      })
      .catch(() => { /* estimation silencieuse */ })
      .finally(() => { if (!cancelled) setCountLoading(false) })
    return () => { cancelled = true }
  }, [scope, segmentId, segmentList])

  function chooseScope(next: Scope) {
    setScope(next)
    setMessage(null)
    if (next === 'countries') setSplitByCountry(true)
    else setSplitByCountry(false)
    if (next !== 'segment') setShowBuilder(false)
  }

  const visibleCountries = useMemo(() => {
    const t = countryQuery.trim().toLowerCase()
    if (!t) return countries
    return countries.filter(c => c.name.toLowerCase().includes(t) || c.iso2.toLowerCase().includes(t))
  }, [countries, countryQuery])

  const selectedCountryRows = useMemo(
    () => countries.filter(c => selectedCountries.includes(c.iso2)),
    [countries, selectedCountries]
  )

  const estimated = useMemo<number | null>(() => {
    if (scope === 'all') return totalContacts
    if (scope === 'countries') return selectedCountryRows.reduce((acc, c) => acc + c.n, 0)
    if (!segmentId) return null
    return segmentCounts[segmentId] ?? null
  }, [scope, totalContacts, selectedCountryRows, segmentId, segmentCounts])

  const canRun =
    cols.length > 0 &&
    (scope === 'all'
      || (scope === 'segment' && segmentId !== '')
      || (scope === 'countries' && selectedCountries.length > 0))

  function moveCol(key: string, dir: -1 | 1) {
    setCols(c => {
      const i = c.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= c.length) return c
      const next = [...c]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function toggleCol(key: string) {
    setCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function onSegmentCreated(seg: { id: string; name: string; rules: SegmentGroup[] }) {
    if (!seg.id) return
    const option: SegmentOption = { id: seg.id, name: seg.name, rules: seg.rules }
    setSegmentList(list => [...list, option].sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    setSegmentId(seg.id)
    setShowBuilder(false)
    setMessage({ tone: 'ok', text: `Segment « ${seg.name} » créé et sélectionné pour l'export.` })
  }

  async function runExport() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/exports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          segmentId: scope === 'segment' ? segmentId : undefined,
          countries: scope === 'countries' ? selectedCountries : undefined,
          splitByCountry,
          columns: cols,
          onlyUnique: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur pendant la génération')
      const files: { name: string; content: string }[] = Array.isArray(json.files) ? json.files : []
      for (const f of files) {
        const a = document.createElement('a')
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(f.content)
        a.download = f.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setMessage({
        tone: 'ok',
        text: `${Number(json.totalRows ?? 0).toLocaleString('fr-FR')} contact(s) exporté(s) — ${files.length} fichier(s) téléchargé(s).`,
      })
      router.refresh()
    } catch (e: unknown) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Erreur inconnue' })
    } finally {
      setBusy(false)
    }
  }

  const selectedSegment = segmentList.find(s => s.id === segmentId)
  const filesLabel = splitByCountry ? 'un par pays' : '1 fichier'

  return (
    <div className="export-layout">
      <div className="space-y-4">
        {/* ── 1. Périmètre ─────────────────────────────────────────── */}
        <section className="glass-card">
          <div className="step-head">
            <span className="step-index">1</span>
            <span className="step-title">Périmètre</span>
            <span className="step-hint">
              {estimated === null
                ? (countLoading ? 'estimation…' : 'à préciser')
                : `${estimated.toLocaleString('fr-FR')} contact(s)`}
            </span>
          </div>

          <div className="choice-grid" role="radiogroup" aria-label="Périmètre de l'export">
            {SCOPES.map(s => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={scope === s.key}
                onClick={() => chooseScope(s.key)}
                className={`choice-card ${scope === s.key ? 'is-selected' : ''}`}
              >
                <span className="choice-title"><span className="choice-radio" aria-hidden />{s.label}</span>
                <span className="choice-desc">{s.desc}</span>
              </button>
            ))}
          </div>

          {scope === 'segment' && (
            <div className="mt-4 space-y-3">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="segment-select">Segment à exporter</label>
                  <select
                    id="segment-select"
                    className="input"
                    value={segmentId}
                    onChange={(e) => { setSegmentId(e.target.value); setMessage(null) }}
                  >
                    <option value="">— choisir un segment —</option>
                    {segmentList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{typeof segmentCounts[s.id] === 'number' ? ` (${segmentCounts[s.id]})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">
                    {selectedSegment
                      ? (typeof segmentCounts[segmentId] === 'number'
                          ? `${segmentCounts[segmentId].toLocaleString('fr-FR')} contact(s) correspondent à ce segment.`
                          : (countLoading ? 'Calcul du nombre de contacts…' : 'Sélectionnez le segment pour l’estimation.'))
                      : 'Aucun segment choisi. Vous pouvez en créer un juste en dessous.'}
                  </p>
                </div>
              </div>

              {!showBuilder && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBuilder(true)}>
                  ＋ Créer un segment
                </button>
              )}

              {showBuilder && (
                <div
                  className="rounded-xl p-3"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-sunken)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.06em' }}>
                      Nouveau segment
                    </p>
                    <button type="button" className="icon-btn" onClick={() => setShowBuilder(false)} aria-label="Fermer">
                      ✕
                    </button>
                  </div>
                  <SegmentBuilder
                    tags={filters.tags}
                    sources={filters.sources}
                    countries={filters.countries}
                    cities={filters.cities}
                    orgId={orgId}
                    onSaved={onSegmentCreated}
                    submitLabel="Créer et sélectionner"
                    embedded
                  />
                </div>
              )}
            </div>
          )}

          {scope === 'countries' && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input"
                  style={{ maxWidth: 260 }}
                  placeholder="Rechercher un pays…"
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  aria-label="Rechercher un pays"
                />
                <span className="badge">{selectedCountries.length} sélectionné(s)</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() =>
                  setSelectedCountries(list => [...new Set([...list, ...visibleCountries.map(c => c.iso2)])])
                }>Tout</button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelectedCountries([])}>
                  Aucun
                </button>
              </div>
              <div className="check-panel">
                {visibleCountries.map(c => {
                  const checked = selectedCountries.includes(c.iso2)
                  return (
                    <label key={c.iso2} className={`check-row ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedCountries(list =>
                          checked ? list.filter(x => x !== c.iso2) : [...list, c.iso2]
                        )}
                      />
                      <span className="check-body">
                        <span className="check-title">{c.name}</span>
                      </span>
                      <span className="check-meta">{c.n.toLocaleString('fr-FR')}</span>
                    </label>
                  )
                })}
                {visibleCountries.length === 0 && (
                  <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    Aucun pays ne correspond à « {countryQuery} ».
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── 2. Colonnes ──────────────────────────────────────────── */}
        <section className="glass-card">
          <div className="step-head">
            <span className="step-index">2</span>
            <span className="step-title">Colonnes</span>
            <span className="step-hint">{cols.length} / {ALL_COLUMNS.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setCols(ALL_COLUMNS.map(c => c.key))}>
              Tout sélectionner
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setCols([])}>
              Tout retirer
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setCols(DEFAULT_COLS)}>
              Sélection recommandée
            </button>
          </div>

          <div className="split-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                Colonnes disponibles
              </p>
              <div className="check-panel">
                {ALL_COLUMNS.map(c => {
                  const checked = cols.includes(c.key)
                  return (
                    <label key={c.key} className={`check-row ${checked ? 'is-selected' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCol(c.key)} />
                      <span className="check-body"><span className="check-title">{c.label}</span></span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                Ordre dans le fichier
              </p>
              <div className="check-panel" style={{ maxHeight: 268 }}>
                {cols.length === 0 && (
                  <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    Aucune colonne sélectionnée.
                  </p>
                )}
                <div className="order-list">
                  {cols.map((k, i) => (
                    <div key={k} className="order-item">
                      <span className="order-num">{i + 1}</span>
                      <span className="order-label">{ALL_COLUMNS.find(c => c.key === k)?.label}</span>
                      <button type="button" className="icon-btn" onClick={() => moveCol(k, -1)}
                        disabled={i === 0} aria-label="Monter">↑</button>
                      <button type="button" className="icon-btn" onClick={() => moveCol(k, 1)}
                        disabled={i === cols.length - 1} aria-label="Descendre">↓</button>
                      <button type="button" className="icon-btn danger" onClick={() => toggleCol(k)}
                        aria-label="Retirer">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {cols.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                En-tête du CSV
              </p>
              <div className="csv-preview">
                {cols.map(k => ALL_COLUMNS.find(c => c.key === k)?.label).join(', ')}
              </div>
            </div>
          )}
        </section>

        {/* ── 3. Options ───────────────────────────────────────────── */}
        <section className="glass-card">
          <div className="step-head">
            <span className="step-index">3</span>
            <span className="step-title">Options</span>
          </div>
          <label className={`check-row ${splitByCountry ? 'is-selected' : ''}`}>
            <input
              type="checkbox"
              checked={splitByCountry}
              onChange={(e) => setSplitByCountry(e.target.checked)}
              disabled={scope === 'countries'}
            />
            <span className="check-body">
              <span className="check-title">Un fichier par pays</span>
              <span className="check-desc">
                {scope === 'countries'
                  ? 'Automatique pour une sélection par pays.'
                  : 'Génère un CSV distinct par pays au lieu d’un seul fichier.'}
              </span>
            </span>
          </label>
          <p className="field-hint mt-2">
            Les fiches fusionnées sont toujours exclues de l’export. Encodage UTF-8, numéros au format international.
          </p>
        </section>
      </div>

      {/* ── Récapitulatif ──────────────────────────────────────────── */}
      <aside className="glass-card summary-panel">
        <h3 className="section-title">Récapitulatif</h3>
        <dl className="m-0">
          <div className="summary-row">
            <dt>Périmètre</dt>
            <dd>
              {scope === 'all' ? 'Base entière'
                : scope === 'segment' ? (selectedSegment?.name ?? '—')
                : `${selectedCountries.length} pays`}
            </dd>
          </div>
          <div className="summary-row">
            <dt>Contacts</dt>
            <dd>{estimated === null ? (countLoading ? '…' : '—') : estimated.toLocaleString('fr-FR')}</dd>
          </div>
          <div className="summary-row">
            <dt>Colonnes</dt>
            <dd>{cols.length}</dd>
          </div>
          <div className="summary-row">
            <dt>Fichiers</dt>
            <dd>{filesLabel}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={runExport}
          disabled={busy || !canRun || estimated === 0}
          className="btn btn-primary mt-4"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Génération…' : 'Générer le CSV'}
        </button>
        {!canRun && (
          <p className="field-hint">
            {cols.length === 0
              ? 'Choisissez au moins une colonne.'
              : scope === 'segment'
                ? 'Choisissez un segment.'
                : 'Choisissez au moins un pays.'}
          </p>
        )}
        {estimated === 0 && canRun && (
          <p className="field-hint" style={{ color: 'var(--warning)' }}>
            Ce périmètre ne contient aucun contact.
          </p>
        )}
        {message && (
          <p className="field-hint" style={{ color: message.tone === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
            {message.text}
          </p>
        )}
      </aside>
    </div>
  )
}
