'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { parseCsvPreview } from '@/lib/contacts/normalize'
import { IMPORT_CHUNK_ROWS, MAX_IMPORT_ROWS } from '@/lib/imports/limits'

type Mapping = Record<string, string>
type DupRules = { keyPhone: boolean; keyEmail: boolean; onDuplicate: 'skip' | 'duplicate' }

const TARGETS: { key: string; label: string; hint: string }[] = [
  { key: 'full_name', label: 'Nom complet', hint: '« Jean Dupont »' },
  { key: 'first_name', label: 'Prénom', hint: '« Jean »' },
  { key: 'last_name', label: 'Nom de famille', hint: '« Dupont »' },
  { key: 'phone', label: 'Téléphone', hint: '« +237 6 70 12 34 56 »' },
  { key: 'email', label: 'Email', hint: '« nom@entreprise.com »' },
  { key: 'country', label: 'Pays', hint: '« Cameroun » ou « CM »' },
  { key: 'city', label: 'Ville', hint: '« Douala »' },
  { key: 'region', label: 'Région', hint: '« Littoral »' },
  { key: 'company', label: 'Entreprise', hint: '« Le Messager TV »' },
  { key: 'job_title', label: 'Fonction', hint: '« Commercial »' },
  { key: 'source', label: 'Source', hint: '« Salon 2026 »' },
]

const STEPS = ['Fichier', 'Aperçu', 'Mapping', 'Doublons', 'Validation', 'Traitement', 'Rapport']

type Report = { inserted: number; updated: number; skipped: number; invalidPhone: number; invalidEmail: number; repaired: number; errors: { row: number; reason: string }[] }
type ImportResponse = { importId?: string; report?: Partial<Report> }

const fmt = (n: number) => n.toLocaleString('fr-FR')

function emptyReport(): Report {
  return { inserted: 0, updated: 0, skipped: 0, invalidPhone: 0, invalidEmail: 0, repaired: 0, errors: [] }
}

/** Additionne le rapport cumulé avec le rapport partiel d'un lot. */
function mergeReport(into: Report, part: Partial<Report> | undefined) {
  if (!part) return
  into.inserted += part.inserted ?? 0
  into.updated += part.updated ?? 0
  into.skipped += part.skipped ?? 0
  into.invalidPhone += part.invalidPhone ?? 0
  into.invalidEmail += part.invalidEmail ?? 0
  into.repaired += part.repaired ?? 0
  into.errors.push(...(part.errors ?? []))
}

/**
 * Envoi d'une requête d'import : le message d'erreur dit toujours ce qui s'est
 * réellement passé (statut HTTP + détail serveur), jamais un générique trompeur.
 */
async function postImport(payload: Record<string, unknown>): Promise<ImportResponse> {
  let res: Response
  try {
    res = await fetch('/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Envoi interrompu : connexion au serveur perdue.')
  }
  const j = (await res.json().catch(() => null)) as (ImportResponse & { error?: string }) | null
  if (!res.ok) {
    const detail = j?.error
    throw new Error(detail ? `Échec (HTTP ${res.status}) — ${detail}` : `Échec de la requête (HTTP ${res.status}).`)
  }
  return j ?? {}
}

export default function ImportWizard({ orgId }: { orgId: string; canWrite?: boolean }) {
  void orgId
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [sample, setSample] = useState<Record<string, unknown>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Mapping>({})
  const [dupRules, setDupRules] = useState<DupRules>({ keyPhone: true, keyEmail: true, onDuplicate: 'skip' })
  const [sourceName, setSourceName] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [importId, setImportId] = useState<string | null>(null)
  const [sentRows, setSentRows] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function onFileChosen(f: File) {
    setFile(f)
    setError(null)
    try {
      const buffer = Buffer.from(await f.arrayBuffer())
      const { headers: h, sample: s, totalRows: tr } = parseCsvPreview(buffer)
      setHeaders(h)
      setSample(s)
      setTotalRows(tr)
      // détection automatique du mapping par heuristique
      const auto: Mapping = {}
      for (const head of h) {
        const k = head.toLowerCase()
        if (/(tel|phone|numero|numéro|mobile|gsm)/.test(k)) auto.phone = head
        else if (/(mail|email|courriel)/.test(k)) auto.email = head
        else if (/full.?name|nom.*(complet|entier)/.test(k)) auto.full_name = head
        else if (/(first.?name|pr[ée]nom)/.test(k)) auto.first_name = head
        else if (/(last.?name|nom(?!.*complet|.*entier))/.test(k)) auto.last_name = head
        else if (/compan|soci[ée]t|entreprise/.test(k)) auto.company = head
        else if (/(job|title|fonction|poste)/.test(k)) auto.job_title = head
        else if (/(country|pays)/.test(k)) auto.country = head
        else if (/(city|ville)/.test(k)) auto.city = head
        else if (/(region|r[ée]gion)/.test(k)) auto.region = head
        else if (/(source|orig)/.test(k)) auto.source = head
      }
      setMapping(auto)
      setStep(1)
    } catch {
      setError('Fichier illisible. Vérifiez le format CSV.')
    }
  }

  const doImport = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setImportId(null)
    setSentRows(0)
    setReport(null)
    let createdId: string | null = null
    let sent = 0
    try {
      const fullText = await file.text()
      const { data } = Papa.parse<Record<string, unknown>>(fullText, {
        header: true,
        skipEmptyLines: 'greedy',
      })
      const rows = data as Record<string, unknown>[]
      if (rows.length === 0) throw new Error('Aucune ligne détectée dans ce fichier.')
      if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error(`Ce fichier compte ${fmt(rows.length)} lignes : le plafond est de ${fmt(MAX_IMPORT_ROWS)} lignes. Découpez-le en plusieurs fichiers.`)
      }

      // 1. création de l'import (métadonnées seulement, aucune ligne de données)
      setProgressLabel('Création de l’import…')
      setProgress(2)
      const created = await postImport({
        action: 'create',
        fileName: file.name,
        source: sourceName || undefined,
        mapping,
        dupRules,
        totalRows: rows.length,
      })
      if (!created.importId) throw new Error('Le serveur n’a pas renvoyé d’identifiant d’import.')
      createdId = created.importId
      setImportId(createdId)

      // 2. envoi par lots : un corps de plusieurs Mo serait rejeté (413) par la plateforme
      const chunkCount = Math.ceil(rows.length / IMPORT_CHUNK_ROWS)
      const merged = emptyReport()
      for (let offset = 0, n = 1; offset < rows.length; offset += IMPORT_CHUNK_ROWS, n++) {
        const slice = rows.slice(offset, offset + IMPORT_CHUNK_ROWS)
        setProgressLabel(
          `Envoi du lot ${n}/${chunkCount} — ${fmt(Math.min(offset + slice.length, rows.length))} / ${fmt(rows.length)} lignes`,
        )
        const part = await postImport({ action: 'chunk', importId: createdId, offset, rows: slice })
        mergeReport(merged, part.report)
        sent += slice.length
        setSentRows(sent)
        setProgress(Math.min(98, 2 + Math.round((sent / rows.length) * 96)))
      }

      // 3. clôture : le serveur finalise le statut et journalise
      await postImport({ action: 'finish', importId: createdId })
      setProgress(100)
      setReport(merged)
      setStep(6)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue pendant l\'import'
      setError(msg)
      if (createdId) {
        // on clôture honnêtement : les lots déjà traités restent en base (statut « partial »)
        void postImport({ action: 'finish', importId: createdId, failed: true }).catch(() => {})
        setStep(5)
      } else {
        setStep(4)
      }
    } finally {
      setBusy(false)
    }
  }, [file, mapping, dupRules, sourceName])

  function sampleValue(header: string | undefined): string {
    if (!header) return ''
    const v = sample[0]?.[header]
    return v === undefined || v === null ? '' : String(v).slice(0, 40)
  }

  const mappedCount = TARGETS.filter(t => mapping[t.key]).length

  return (
    <div className="space-y-4">
      <div className="stepper" aria-label="Étapes de l'import">
        {STEPS.map((s, i) => (
          <div key={s} className={`stepper-item ${i === step ? 'is-active' : ''}`}>
            <span className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>{i + 1}</span>
            <span className="stepper-label">{s}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="glass-card space-y-4">
          <div
            className={`dropzone ${dragging ? 'is-over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) onFileChosen(f)
            }}
          >
            <div className="dropzone-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Glissez-déposez votre fichier CSV ici
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>ou</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f) }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
              className="btn btn-primary mt-3"
            >
              Choisir un fichier
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Encodage UTF-8, Latin1 et UTF-16 détectés automatiquement · 20 Mo et {fmt(MAX_IMPORT_ROWS)} lignes maximum
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="import-source">Nom de la source (optionnel)</label>
            <input
              id="import-source"
              className="input"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Ex. Salon Douala 2026, WhatsApp Business…"
            />
            <p className="field-hint">Utile pour retrouver cet import et segmenter plus tard sur la source.</p>
          </div>

          {error && <p className="alert-error">{error}</p>}
        </div>
      )}

      {step === 1 && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title mb-0">Aperçu du fichier</h3>
            <span className="badge">{totalRows.toLocaleString('fr-FR')} lignes · {headers.length} colonnes</span>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 280 }}>
            <table className="data-table text-xs">
              <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => (
                      <td key={h} className="max-w-[180px] truncate">{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint">Vérifiez que les colonnes sont bien reconnues avant de continuer.</p>
          {totalRows > MAX_IMPORT_ROWS && (
            <p className="alert-error">
              Ce fichier compte {fmt(totalRows)} lignes, au-delà du plafond de {fmt(MAX_IMPORT_ROWS)} lignes par import.
              Découpez-le en plusieurs fichiers avant de continuer.
            </p>
          )}
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(0)} className="btn btn-ghost">← Fichier</button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={totalRows === 0 || totalRows > MAX_IMPORT_ROWS}
              className="btn btn-primary"
            >
              Mapping →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title mb-0">Mapping des colonnes</h3>
            <span className="badge badge-teal">{mappedCount} / {TARGETS.length} champs associés</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            L’association est détectée automatiquement : seuls le téléphone et le nom sont vraiment utiles.
          </p>
          <div className="form-grid">
            {TARGETS.map(t => {
              const val = mapping[t.key] ?? ''
              return (
                <div key={t.key} className="form-field">
                  <label htmlFor={`map-${t.key}`}>
                    {t.label}
                    {t.key === 'phone' && <span className="badge badge-teal ml-2">essentiel</span>}
                  </label>
                  <select
                    id={`map-${t.key}`}
                    className="input text-xs"
                    value={val}
                    onChange={(e) => setMapping(m => ({ ...m, [t.key]: e.target.value }))}
                  >
                    <option value="">— ignorer cette colonne —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <p className="field-hint">
                    {val ? `Ex. ${sampleValue(val) || t.hint}` : `Aucune colonne — ${t.hint}`}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between pt-1">
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost">← Aperçu</button>
            <button type="button" onClick={() => setStep(3)} className="btn btn-primary">Doublons →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card space-y-4">
          <h3 className="section-title mb-0">Règles de doublons</h3>

          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Détection</p>
            <div className="check-panel">
              <label className={`check-row ${dupRules.keyPhone ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={dupRules.keyPhone}
                  onChange={(e) => setDupRules(r => ({ ...r, keyPhone: e.target.checked }))} />
                <span className="check-body">
                  <span className="check-title">Par numéro normalisé</span>
                  <span className="check-desc">Recommandé : +237 6 70… et 670… sont le même contact.</span>
                </span>
              </label>
              <label className={`check-row ${dupRules.keyEmail ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={dupRules.keyEmail}
                  onChange={(e) => setDupRules(r => ({ ...r, keyEmail: e.target.checked }))} />
                <span className="check-body">
                  <span className="check-title">Par email</span>
                  <span className="check-desc">Utile si vos fiches n’ont pas toujours de téléphone.</span>
                </span>
              </label>
            </div>
            <p className="field-hint">Les règles s’appliquent aux lignes du fichier déjà présentes en base et aux doublons internes du fichier.</p>
          </div>

          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Si le contact existe déjà</p>
            <div className="check-panel">
              <label className={`check-row ${dupRules.onDuplicate === 'skip' ? 'is-selected' : ''}`}>
                <input type="radio" name="dup" checked={dupRules.onDuplicate === 'skip'}
                  onChange={() => setDupRules(r => ({ ...r, onDuplicate: 'skip' }))} />
                <span className="check-body">
                  <span className="check-title">Ignorer (recommandé)</span>
                  <span className="check-desc">La ligne déjà présente est comptée doublon et n’est pas réimportée.</span>
                </span>
              </label>
              <label className={`check-row ${dupRules.onDuplicate === 'duplicate' ? 'is-selected' : ''}`}>
                <input type="radio" name="dup" checked={dupRules.onDuplicate === 'duplicate'}
                  onChange={() => setDupRules(r => ({ ...r, onDuplicate: 'duplicate' }))} />
                <span className="check-body">
                  <span className="check-title">Importer quand même</span>
                  <span className="check-desc">Les fiches en double sont aussi créées : vous les fusionnez ensuite au centre Doublons.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-1">
            <button type="button" onClick={() => setStep(2)} className="btn btn-ghost">← Mapping</button>
            <button type="button" onClick={() => setStep(4)} className="btn btn-primary">Validation →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-card space-y-4">
          <h3 className="section-title mb-0">Récapitulatif</h3>
          <dl className="m-0">
            <div className="summary-row">
              <dt>Fichier</dt>
              <dd>{file?.name ?? '—'}</dd>
            </div>
            <div className="summary-row">
              <dt>Contenu</dt>
              <dd>{totalRows.toLocaleString('fr-FR')} lignes · {headers.length} colonnes</dd>
            </div>
            <div className="summary-row">
              <dt>Source</dt>
              <dd>{sourceName || 'non précisée'}</dd>
            </div>
            <div className="summary-row">
              <dt>Téléphone</dt>
              <dd>{mapping.phone || '—'}</dd>
            </div>
            <div className="summary-row">
              <dt>Email</dt>
              <dd>{mapping.email || '—'}</dd>
            </div>
            <div className="summary-row">
              <dt>Doublons</dt>
              <dd>
                {dupRules.keyPhone ? 'numéro' : ''}
                {dupRules.keyPhone && dupRules.keyEmail ? ' + ' : ''}
                {dupRules.keyEmail ? 'email' : ''}
                {!dupRules.keyPhone && !dupRules.keyEmail ? 'aucune détection' : ''}
                {' · '}{dupRules.onDuplicate === 'skip' ? 'ignorer' : 'importer quand même'}
              </dd>
            </div>
          </dl>
          <p className="field-hint">
            Les téléphones sont normalisés au format international et les noms remis en casse titre.
            L’envoi se fait par lots de {fmt(IMPORT_CHUNK_ROWS)} lignes : un lot déjà importé reste en base si la suite échoue.
          </p>
          {error && <p className="alert-error">{error}</p>}
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="btn btn-ghost">← Doublons</button>
            <button type="button" onClick={() => { setStep(5); doImport() }} disabled={busy} className="btn btn-primary">
              {busy ? 'Traitement…' : 'Lancer l’import'}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="glass-card space-y-3">
          <h3 className="section-title mb-0">Traitement en cours</h3>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{progressLabel} — {progress}%</p>
          {error && (
            <>
              <p className="alert-error">{error}</p>
              {sentRows > 0 && (
                <p className="field-hint">
                  {fmt(sentRows)} lignes ont été envoyées et importées : elles restent en base. Les lignes suivantes n’ont pas été traitées.
                </p>
              )}
              <div className="flex justify-between pt-1">
                <button type="button" onClick={() => setStep(4)} className="btn btn-ghost">← Récapitulatif</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 6 && report && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title mb-0">Rapport d’import</h3>
            {importId && <span className="badge">#{importId.slice(0, 8)}</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nouveaux contacts</p><p className="metric" style={{ color: 'var(--success)' }}>{report.inserted}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mises à jour</p><p className="metric">{report.updated}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Doublons ignorés</p><p className="metric">{report.skipped}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Numéros réparés</p><p className="metric" style={{ color: 'var(--success)' }}>{report.repaired}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Numéros invalides</p><p className="metric" style={{ color: report.invalidPhone > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{report.invalidPhone}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Emails invalides</p><p className="metric" style={{ color: 'var(--danger)' }}>{report.invalidEmail}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Erreurs</p><p className="metric" style={{ color: 'var(--danger)' }}>{report.errors.length}</p></div>
          </div>
          {report.errors.length > 0 && (
            <div className="alert-error" style={{ maxHeight: 168, overflowY: 'auto' }}>
              {report.errors.slice(0, 50).map((e, i) => (
                <p key={i}>Ligne {e.row} : {e.reason}</p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/contacts" className="btn btn-primary">Voir les contacts</Link>
            <Link href="/duplicates" className="btn btn-ghost">Passer aux doublons</Link>
            <Link href="/exports/new" className="btn btn-ghost">Exporter un segment</Link>
            <Link href="/imports" className="btn btn-ghost">Retour aux imports</Link>
          </div>
        </div>
      )}
    </div>
  )
}
