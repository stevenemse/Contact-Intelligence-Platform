'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsForm({ isOwner, isAdmin, orgName, plan, quota, contactCount }: {
  isOwner: boolean
  isAdmin: boolean
  orgName: string
  plan: string
  quota: number
  contactCount: number
}) {
  const router = useRouter()
  const [name, setName] = useState(orgName)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const pct = Math.min(100, Math.round((contactCount / Math.max(1, quota)) * 100))

  async function save() {
    setBusy(true); setSaved(false); setMsg(null)
    const res = await fetch('/api/settings/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setBusy(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg(json.error ?? 'Erreur')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="glass-card space-y-4">
      <div>
        <label className="text-xs font-medium text-[color:var(--text-secondary)]">Nom de l&apos;organisation</label>
        <div className="flex gap-2 mt-1">
          <input className="input" disabled={!isAdmin} value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
          {isAdmin && <button onClick={save} disabled={busy || !name.trim()} className="btn btn-primary">Enregistrer</button>}
          {saved && <span className="badge badge-green self-center">Enregistré</span>}
          {msg && <span className="text-sm text-[color:var(--danger)] self-center">{msg}</span>}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-[color:var(--text-secondary)]">Quota de contacts ({plan})</span>
          <span className="font-medium">{contactCount} / {quota.toLocaleString('fr-FR')}</span>
        </div>
        <div className="w-full bg-[color:#e3e9e6] rounded-full h-2.5">
          <div className={`h-2.5 rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-teal-700'}`} style={{ width: `${pct}%` }} />
        </div>
        {pct > 90 && (
          <p className="text-xs text-[color:var(--danger)] mt-1">Quota presque atteint — pensez à migrer vers un plan supérieur.</p>
        )}
      </div>
    </div>
  )
}
