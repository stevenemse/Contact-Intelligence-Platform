'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { parseCsvPreview } from '@/lib/contacts/normalize'

type Mapping = Record<string, string>
type DupRules = { keyPhone: boolean; keyEmail: boolean; onDuplicate: 'skip' | 'update' }

const TARGETS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Nom complet' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'last_name', label: 'Nom de famille' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'country', label: 'Pays' },
  { key: 'city', label: 'Ville' },
  { key: 'region', label: 'Région' },
  { key: 'company', label: 'Entreprise' },
  { key: 'job_title', label: 'Fonction' },
  { key: 'source', label: 'Source' },
]

const STEPS = ['Fichier', 'Aperçu', 'Mapping', 'Doublons', 'Validation', 'Traitement', 'Rapport']

type Report = { inserted: number; updated: number; skipped: number; invalidPhone: number; invalidEmail: number; errors: { row: number; reason: string }[] }

export default function ImportWizard({ orgId }: { orgId: string; canWrite?: boolean }) {
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFileChosen(f: File) {
    setFile(f)
    setError(null)
    try {
      const buffer = Buffer.from(await f.arrayBuffer())
      const { headers: h, sample: s, totalRows: tr } = parseCsvPreview(buffer)
      setHeaders(h)
      setSample(s)
      setTotalRows(tr)
      //détection automatique du mapping par heuristique
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
    setBusy(true); setError(null)
    if (!file) { setBusy(false); return }
    try {
      setProgressLabel('Envoi au serveur (normalisation + dédoublonnage)...')
      setProgress(15)
      const fullText = await file.text()
      const { data } = Papa.parse<Record<string, unknown>>(fullText, {
        header: true,
        skipEmptyLines: 'greedy',
      })
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          source: sourceName || undefined,
          mapping,
          dupRules: { keyPhone: dupRules.keyPhone, keyEmail: dupRules.keyEmail },
          rows: data as Record<string, unknown>[],
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Import impossible (Supabase configuré ?)')
      setProgress(100)
      setImportId(j.importId ?? null)
      const r: Report = {
        inserted: j.report?.inserted ?? 0,
        updated: j.report?.updated ?? 0,
        skipped: j.report?.skipped ?? 0,
        invalidPhone: j.report?.invalidPhone ?? 0,
        invalidEmail: j.report?.invalidEmail ?? 0,
        errors: (j.report?.errors ?? []) as Report['errors'],
      }
      setReport(r)
      setStep(6)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue pendant l\'import')
    } finally {
      setBusy(false)
    }
  }, [file, mapping, dupRules, sourceName])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>{i + 1}</div>
            <span className="text-xs text-[color:var(--text-muted)] hidden md:inline">{s}</span>
            {i < STEPS.length - 1 && <span className="text-[color:var(--text-primary)]">→</span>}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="glass-card">
          <div className="border-2 border-dashed border-white/15 rounded-2xl p-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFileChosen(f) }}>
            <p className="text-lg font-semibold text-[color:var(--text-primary)]">Glissez-déposez votre fichier CSV ici</p>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">ou</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f) }} />
            <button onClick={() => fileRef.current?.click()} className="btn btn-primary mt-3">Choisir un fichier</button>
            <p className="text-xs text-[color:var(--text-secondary)] mt-3">Encodage UTF-8, Latin1 et UTF-16 détectés automatiquement · max 20 Mo</p>
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-[color:var(--text-muted)]">Nom de la source (optionnel)</label>
            <input className="input mt-1" value={sourceName} onChange={(e) => setSourceName(e.target.value)}
              placeholder="Ex. Salon Douala 2026, WhatsApp Business..." />
          </div>
          {error && <p className="alert-error">{error}</p>}
        </div>
      )}

      {step === 1 && (
        <div className="glass-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Aperçu du fichier</h3>
            <span className="badge">{totalRows} lignes · {headers.length} colonnes</span>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="data-table text-xs">
              <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i}>{headers.map(h => <td key={h} className="max-w-[160px] truncate">{String(row[h] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="btn btn-ghost">← Fichier</button>
            <button onClick={() => setStep(2)} className="btn btn-primary">Mapping →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card space-y-3">
          <h3 className="section-title">Mapping des colonnes</h3>
          <p className="text-xs text-[color:var(--text-secondary)]">Association détectée automatiquement. Corrigez si besoin.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TARGETS.map(t => (
              <div key={t.key} className="flex items-center gap-3">
                <label className="text-xs font-medium w-32 shrink-0 text-[color:var(--text-secondary)]">{t.label}</label>
                <select className="input text-xs" value={mapping[t.key] ?? ''}
                  onChange={(e) => setMapping(m => ({ ...m, [t.key]: e.target.value }))}>
                  <option value="">— ignorer cette colonne —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn btn-ghost">← Aperçu</button>
            <button onClick={() => setStep(3)} className="btn btn-primary">Doublons →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card space-y-4">
          <h3 className="section-title">Règles de doublons</h3>
          <label className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
            <input type="checkbox" checked={dupRules.keyPhone} onChange={(e) => setDupRules(r => ({ ...r, keyPhone: e.target.checked }))} />
            Détecter les doublons par numéro normalisé (recommandé)
          </label>
          <label className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
            <input type="checkbox" checked={dupRules.keyEmail} onChange={(e) => setDupRules(r => ({ ...r, keyEmail: e.target.checked }))} />
            Détecter les doublons par email
          </label>
          <div>
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Si contact déjà présent :</p>
            <label className="flex items-center gap-3 text-sm mt-1 text-[color:var(--text-secondary)]">
              <input type="radio" name="dup" checked={dupRules.onDuplicate === 'skip'}
                onChange={() => setDupRules(r => ({ ...r, onDuplicate: 'skip' }))} />
              Ignorer le contact (doublons sautés)
            </label>
            <label className="flex items-center gap-3 text-sm mt-1 text-[color:var(--text-secondary)]">
              <input type="radio" name="dup" checked={dupRules.onDuplicate === 'update'}
                onChange={() => setDupRules(r => ({ ...r, onDuplicate: 'update' }))} />
              Mettre à jour (fusions signalées dans le centre de revue)
            </label>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="btn btn-ghost">← Mapping</button>
            <button onClick={() => setStep(4)} className="btn btn-primary">Validation →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-card space-y-4">
          <h3 className="section-title">Récapitulatif</h3>
          <ul className="text-sm space-y-1 text-[color:var(--text-secondary)]">
            <li><b>{file?.name}</b> — {totalRows} lignes, {headers.length} colonnes</li>
            <li>Téléphone : {mapping.phone ?? '—'} · Email : {mapping.email ?? '—'} · Nom : {[mapping.full_name, mapping.first_name, mapping.last_name].filter(Boolean).join(' ') || '—'}</li>
            <li>Doublons par numéro : {dupRules.keyPhone ? 'oui' : 'non'} · par email : {dupRules.keyEmail ? 'oui' : 'non'} · comportement : <b>{dupRules.onDuplicate === 'skip' ? 'ignorer' : 'mettre à jour'}</b></li>
          </ul>
          <p className="text-xs text-[color:var(--text-secondary)]">
            Les téléphones seront normalisés en format international (libphonenumber) et les noms en casse title.
          </p>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="btn btn-ghost">← Doublons</button>
            <button onClick={() => { setStep(5); doImport() }} disabled={busy} className="btn btn-primary">
              {busy ? 'Traitement...' : 'Lancer l\'import'}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="glass-card space-y-3">
          <h3 className="section-title">Traitement en cours</h3>
          <div className="w-full bg-[color:var(--bg-sunken)] rounded-full h-3 overflow-hidden">
            <div className="bg-emerald-500 h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-[color:var(--text-secondary)]">{progressLabel} — {progress}%</p>
          {error && <p className="alert-error">{error}</p>}
        </div>
      )}

      {step === 6 && report && (
        <div className="glass-card space-y-3">
          <h3 className="section-title">Rapport d&apos;import</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><p className="text-xs text-[color:var(--text-muted)]">Nouveaux contacts</p><p className="metric text-[color:var(--success)]">{report.inserted}</p></div>
            <div><p className="text-xs text-[color:var(--text-muted)]">Mises à jour</p><p className="metric">{report.updated}</p></div>
            <div><p className="text-xs text-[color:var(--text-muted)]">Doublons ignorés</p><p className="metric">{report.skipped}</p></div>
            <div><p className="text-xs text-[color:var(--text-muted)]">Numéros invalides</p><p className="metric text-[color:var(--danger)]">{report.invalidPhone}</p></div>
            <div><p className="text-xs text-[color:var(--text-muted)]">Emails invalides</p><p className="metric text-[color:var(--danger)]">{report.invalidEmail}</p></div>
            <div><p className="text-xs text-[color:var(--text-muted)]">Erreurs</p><p className="metric text-[color:var(--danger)]">{report.errors.length}</p></div>
          </div>
          {report.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto text-xs bg-rose-500/10 rounded-xl p-3">
              {report.errors.slice(0, 50).map((e, i) => (
                <p key={i} className="text-rose-300">Ligne {e.row} : {e.reason}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Link href="/contacts" className="btn btn-primary">Voir les contacts</Link>
            <Link href="/imports" className="btn btn-ghost">Retour aux imports</Link>
            <Link href="/duplicates" className="btn btn-ghost">Passer aux doublons</Link>
          </div>
        </div>
      )}
    </div>
  )
}
