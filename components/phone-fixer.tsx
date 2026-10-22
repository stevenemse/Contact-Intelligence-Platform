'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Suggestion = {
  phoneId: string
  contactId: string
  raw: string
  e164: string | null
  suggested: string
  rule: string
}

type SuggestRes = {
  suggestions: Suggestion[]
  stats: { total: number; fixable: number; unfixable: number }
}

/**
 * Bandeau discret : détecte les numéros réparables selon l'indicatif
 * (ex: +237 77 35 52 21 → +237 6 77 35 52 21) et permet de les corriger en 1 clic.
 */
export default function PhoneFixer() {
  const router = useRouter()
  const [data, setData] = useState<SuggestRes | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/phone-fix/suggest')
      if (!res.ok) return
      const j = (await res.json()) as SuggestRes
      setData(j)
      setSelected(new Set(j.suggestions.map(s => s.phoneId)))
    } catch { /* silencieux : bandeau optionnel */ }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function apply() {
    if (!data || selected.size === 0) return
    setBusy(true); setMsg(null)
    try {
      const fixes = data.suggestions
        .filter(s => selected.has(s.phoneId))
        // E.164 strict sans espaces pour l'API (l'affiche reste lisible)
        .map(s => ({ phoneId: s.phoneId, e164: s.suggested.replace(/\s+/g, '') }))
      const res = await fetch('/api/phone-fix/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixes }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setMsg(`✅ ${j.applied} numéro(s) corrigé(s).`)
      // recharger la liste
      await load()
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setBusy(false)
    }
  }

  if (!data || data.suggestions.length === 0) {
    if (msg) {
      return <div className="kpi-card text-sm" style={{ color: 'var(--text-muted)' }}>{msg}</div>
    }
    return null // rien à corriger : on n'encombre pas l'UI
  }

  return (
    <div className="kpi-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-sm">🔧 Correcteur de numéros</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {data.stats.fixable} numéro(s) réparables selon l&apos;indicatif (sur {data.stats.total} invalide(s))
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(o => !o)} className="btn btn-ghost text-xs">
            {open ? 'Masquer' : 'Voir les corrections'}
          </button>
          <button onClick={apply} disabled={busy || selected.size === 0} className="btn btn-primary text-xs">
            {busy ? 'Correction...' : `Corriger ${selected.size} numéro(s)`}
          </button>
        </div>
      </div>
      {msg && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{msg}</p>}
      {open && (
        <ul className="space-y-1 max-h-72 overflow-y-auto border border-white/10 rounded-xl p-2">
          {data.suggestions.map(s => (
            <li key={s.phoneId} className="flex items-center gap-2 text-sm px-1">
              <input
                type="checkbox"
                checked={selected.has(s.phoneId)}
                onChange={() => setSelected(prev => {
                  const next = new Set(prev)
                  if (next.has(s.phoneId)) next.delete(s.phoneId)
                  else next.add(s.phoneId)
                  return next
                })}
              />
              <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{s.e164 ?? s.raw}</span>
              <span style={{ color: 'var(--text-faint)' }}>→</span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--brand)' }}>{s.suggested}</span>
              <span className="ml-auto text-[10px] truncate max-w-[220px]" style={{ color: 'var(--text-faint)' }} title={s.rule}>{s.rule}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
