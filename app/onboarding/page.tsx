'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Création impossible')
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="glass-cardauth-card fade-up max-w-md">
        <h1>Créer votre espace de travail</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Un espace de travail regroupe vos contacts, votre équipe et vos segments.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label>Nom de l&apos;organisation</label>
            <input className="input" required value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Agence Douala Digital" />
          </div>
          {error && <p className="alert-error">{error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={loading || !name.trim()}>
            {loading ? 'Création...' : "Créer l'espace"}
          </button>
        </form>
      </div>
    </main>
  )
}
