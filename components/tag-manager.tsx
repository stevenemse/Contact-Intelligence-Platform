'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tag = { id: string; name: string; color: string; count: number }

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#64748b']

export default function TagManager({ tags, canWrite, orgId: _orgId }: { tags: Tag[]; canWrite: boolean; orgId: string }) {
  void _orgId
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)

  async function addTag() {
    if (!name.trim()) return
    setBusy(true)
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name: name.trim(), color }),
    })
    setName('')
    setBusy(false)
    router.refresh()
  }

  async function deleteTag(id: string) {
    if (!confirm('Supprimer ce tag ? Les associations contacts seront supprimées.')) return
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', tagId: id }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="glass-card flex flex-wrap gap-2 items-center">
          <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="#Salon2026" onKeyDown={(e) => e.key === 'Enter' && addTag()} />
          <div className="flex gap-1">
            {PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }} aria-label={`Couleur ${c}`} />
            ))}
          </div>
          <button onClick={addTag} disabled={busy || !name.trim()} className="btn btn-primary">Ajouter le tag</button>
        </div>
      )}
      <div className="glass-card">
        <table className="data-table">
          <thead><tr><th>Tag</th><th>Contacts</th><th></th></tr></thead>
          <tbody>
            {tags.length === 0 && <tr><td colSpan={3} className="text-center text-[color:var(--text-secondary)] py-6">Aucun tag</td></tr>}
            {tags.map(t => (
              <tr key={t.id}>
                <td><span className="badge" style={{ background: t.color + '22', color: t.color }}>#{t.name}</span></td>
                <td>{t.count}</td>
                <td>{canWrite && (
                  <button onClick={() => deleteTag(t.id)} className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--danger)]">supprimer</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
