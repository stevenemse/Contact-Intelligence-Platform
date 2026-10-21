'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Operator = 'eq' | 'neq' | 'contains' | 'starts_with' | 'is_empty' | 'not_empty' | 'gt' | 'lt'
type Field = 'full_name' | 'company' | 'job_title' | 'source' | 'notes' | 'country' | 'city' | 'tag' | 'phone_valid' | 'email'

type Rule = { field: Field; op: Operator; value: string }
type Group = { and: Rule[]; or: Rule[]; not: Rule[] }

const FIELDS: { key: Field; label: string }[] = [
  { key: 'full_name', label: 'Nom' },
  { key: 'company', label: 'Entreprise' },
  { key: 'job_title', label: 'Fonction' },
  { key: 'source', label: 'Source' },
  { key: 'notes', label: 'Notes' },
  { key: 'country', label: 'Pays' },
  { key: 'city', label: 'Ville' },
  { key: 'tag', label: 'Tag' },
  { key: 'email', label: 'Email' },
  { key: 'phone_valid', label: 'Téléphone valide' },
]

const OPS: { key: Operator; label: string }[] = [
  { key: 'eq', label: 'égal à' },
  { key: 'neq', label: 'différent de' },
  { key: 'contains', label: 'contient' },
  { key: 'starts_with', label: 'commence par' },
  { key: 'is_empty', label: 'est vide' },
  { key: 'not_empty', label: "n'est pas vide" },
  { key: 'gt', label: 'supérieur à' },
  { key: 'lt', label: 'inférieur à' },
]

const EMPTY_RULE: Rule = { field: 'full_name', op: 'contains', value: '' }

export type SegmentGroup = { and: Rule[]; or: Rule[]; not: Rule[] }

export default function SegmentBuilder({ tags, sources, countries, cities, orgId, onSaved, submitLabel, embedded = false }: {
  tags: string[]
  sources: string[]
  countries: { iso2: string; name: string }[]
  cities: string[]
  orgId: string
  /** Mode « intégré » : on prévient l'appelant au lieu de quitter la page. */
  onSaved?: (segment: { id: string; name: string; rules: SegmentGroup[] }) => void
  submitLabel?: string
  /** Rendu compact sans cartes, pour un formulaire hôte (export). */
  embedded?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groups, setGroups] = useState<Group[]>([{ and: [{ ...EMPTY_RULE }], or: [], not: [] }])
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateGroup(i: number, patch: Partial<Group>) {
    setGroups(g => g.map((gr, gi) => gi === i ? { ...gr, ...patch } : gr))
    setSaved(false); setCount(null)
  }

  function addRule(i: number, mode: 'and' | 'or' | 'not') {
    const gr = groups[i]
    updateGroup(i, { [mode]: [...gr[mode], { ...EMPTY_RULE }] } as Partial<Group>)
  }

  function editRule(i: number, mode: 'and' | 'or' | 'not', ri: number, patch: Partial<Rule>) {
    const gr = groups[i]
    const list = gr[mode].map((r, idx) => idx === ri ? { ...r, ...patch } : r)
    updateGroup(i, { [mode]: list } as Partial<Group>)
  }

  function removeRule(i: number, mode: 'and' | 'or' | 'not', ri: number) {
    const gr = groups[i]
    updateGroup(i, { [mode]: gr[mode].filter((_, idx) => idx !== ri) } as Partial<Group>)
  }

  function addGroup() {
    setGroups(g => [...g, { and: [{ ...EMPTY_RULE }], or: [], not: [] }])
  }

  function serialize(): SegmentGroup[] {
    // SERIALIZATION : array of groups, each AND(...) OR(...) NOT(...)
    return groups.map(gr => ({
      and: gr.and.filter(r => r.value || ['is_empty', 'not_empty'].includes(r.op)),
      or: gr.or.filter(r => r.value || ['is_empty', 'not_empty'].includes(r.op)),
      not: gr.not.filter(r => r.value || ['is_empty', 'not_empty'].includes(r.op)),
    })).filter(gr => gr.and.length + gr.or.length + gr.not.length > 0)
  }

  async function previewCount() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/segments/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: serialize() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Estimation impossible')
      setCount(j.count)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
    setBusy(false)
  }

  async function save() {
    if (!name.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name.trim(), description: description.trim() || undefined, rules: serialize() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Enregistrement impossible')
      setSaved(true)
      if (onSaved) {
        onSaved({ id: String(json.id ?? ''), name: name.trim(), rules: serialize() })
        setName('')
        setDescription('')
        setCount(null)
      } else {
        router.push('/segments')
        router.refresh()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
    setBusy(false)
  }

  const blockClass = embedded ? 'space-y-3' : 'glass-card space-y-3'

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4'}>
      <div className={blockClass}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[color:var(--text-muted)]">Nom du segment</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Prospects Douala 2026" />
          </div>
          <div>
            <label className="text-xs font-medium text-[color:var(--text-muted)]">Description (optionnel)</label>
            <input className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      {groups.map((gr, i) => (
        <div key={i} className={blockClass}>
          {i > 0 && <p className="text-xs font-bold text-[color:var(--text-secondary)]">OU (intersection entre groupes = UNION)</p>}
          <RuleList mode="and" label="ET (AND)" rules={gr.and} groupIdx={i}
            editRule={editRule} removeRule={removeRule} addRule={addRule}
            tags={tags} sources={sources} countries={countries} cities={cities} />
          <RuleList mode="or" label="OU (OR)" rules={gr.or} groupIdx={i}
            editRule={editRule} removeRule={removeRule} addRule={addRule}
            tags={tags} sources={sources} countries={countries} cities={cities} />
          <RuleList mode="not" label="SAUF (NOT)" rules={gr.not} groupIdx={i}
            editRule={editRule} removeRule={removeRule} addRule={addRule}
            tags={tags} sources={sources} countries={countries} cities={cities} badgeClass="badge-red" />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addGroup} className="btn btn-ghost">+ Groupe (OR)</button>
        <button onClick={previewCount} disabled={busy} className="btn btn-ghost">
          {busy ? '...' : 'Estimer le nombre de contacts'}
        </button>
        {count !== null && <span className="badge badge-blue">{count} contact(s)</span>}
        <button onClick={save} disabled={busy || !name.trim()} className="btn btn-primary ml-auto">
          {submitLabel ?? 'Enregistrer le segment'}
        </button>
        {saved && <span className="badge badge-green">Segment enregistré</span>}
        {error && <p className="alert-error w-full">{error}</p>}
      </div>
    </div>
  )
}

function RuleList({ mode, label, rules, groupIdx, editRule, removeRule, addRule, tags, sources, countries, cities, badgeClass = 'badge-blue' }: {
  mode: 'and' | 'or' | 'not'
  label: string
  rules: Rule[]
  groupIdx: number
  editRule: (i: number, mode: 'and' | 'or' | 'not', ri: number, patch: Partial<Rule>) => void
  removeRule: (i: number, mode: 'and' | 'or' | 'not', ri: number) => void
  addRule: (i: number, mode: 'and' | 'or' | 'not') => void
  tags: string[]
  sources: string[]
  countries: { iso2: string; name: string }[]
  cities: string[]
  badgeClass?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`badge ${badgeClass}`}>{label}</span>
        <button onClick={() => addRule(groupIdx, mode)} className="text-xs text-[color:var(--success)] hover:underline">
          + ajouter une condition
        </button>
      </div>
      {rules.map((r, ri) => (
        <div key={ri} className="flex flex-wrap gap-2 items-center py-1">
          <select className="input max-w-[150px] text-xs" value={r.field}
            onChange={(e) => {
              const field = e.target.value as Field
              const needsValue = !['is_empty', 'not_empty'].includes(r.op)
              // on repart d'une valeur propre : « oui » pour un booléen, vide sinon
              editRule(groupIdx, mode, ri, { field, value: needsValue && field === 'phone_valid' ? 'true' : '' })
            }}>
            {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className="input max-w-[150px] text-xs" value={r.op}
            onChange={(e) => editRule(groupIdx, mode, ri, { op: e.target.value as Operator })}>
            {OPS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {!['is_empty', 'not_empty'].includes(r.op) && (
            r.field === 'tag' ? (
              <select className="input max-w-[170px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })}>
                <option value="">— choisir —</option>
                {tags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : r.field === 'source' ? (
              <select className="input max-w-[170px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })}>
                <option value="">— choisir —</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : r.field === 'country' ? (
              <select className="input max-w-[180px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })}>
                <option value="">— choisir —</option>
                {countries.map(c => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
              </select>
            ) : r.field === 'city' ? (
              <select className="input max-w-[170px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })}>
                <option value="">— choisir —</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : r.field === 'phone_valid' ? (
              <select className="input max-w-[140px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })}>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            ) : (
              <input className="input max-w-[220px] text-xs" value={r.value}
                onChange={(e) => editRule(groupIdx, mode, ri, { value: e.target.value })} />
            )
          )}
          <button onClick={() => removeRule(groupIdx, mode, ri)}
            className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--danger)]">supprimer</button>
        </div>
      ))}
      {rules.length === 0 && <p className="text-xs text-[color:var(--text-secondary)] italic">Aucune condition {mode.toUpperCase()}</p>}
    </div>
  )
}
