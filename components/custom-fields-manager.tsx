'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Field = { id: string; label: string; key: string; type: string }

const TYPES = [
  { key: 'text', label: 'Texte' },
  { key: 'number', label: 'Nombre' },
  { key: 'date', label: 'Date' },
  { key: 'boolean', label: 'Oui / Non' },
]

export default function CustomFieldsManager({ fields, canWrite, orgId: _orgId }: { fields: Field[]; canWrite: boolean; orgId: string }) {
  void _orgId
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [busy, setBusy] = useState(false)

  async function addField() {
    if (!label.trim()) return
    setBusy(true)
    await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', label: label.trim(), type }),
    })
    setLabel('')
    setBusy(false)
    router.refresh()
  }

  async function deleteField(id: string) {
    if (!confirm('Supprimer ce champ ? Toutes ses valeurs seront perdues.')) return
    await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', fieldId: id }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="glass-card flex flex-wrap gap-2 items-center">
          <input className="input max-w-xs" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. Secteur d'activité" onKeyDown={(e) => e.key === 'Enter' && addField()} />
          <select className="input max-w-[150px]" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <button onClick={addField} disabled={busy || !label.trim()} className="btn btn-primary">Ajouter</button>
        </div>
      )}
      <div className="glass-card">
        <table className="data-table">
          <thead><tr><th>Libellé</th><th>Clé technique</th><th>Type</th><th></th></tr></thead>
          <tbody>
            {fields.length === 0 && <tr><td colSpan={4} className="text-center text-[color:var(--text-secondary)] py-6">Aucun champ personnalisé</td></tr>}
            {fields.map(f => (
              <tr key={f.id}>
                <td className="font-medium">{f.label}</td>
                <td><code className="text-xs text-[color:var(--text-secondary)]">{f.key}</code></td>
                <td>{TYPES.find(t => t.key === f.type)?.label ?? f.type}</td>
                <td>{canWrite && (
                  <button onClick={() => deleteField(f.id)} className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--danger)]">supprimer</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
