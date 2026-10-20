'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Envoi impossible')
      }
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    }
    setLoading(false)
  }

  return (
    <main className="auth-page">
      <div className="glass-cardauth-card fade-up">
        <h1>Mot de passe oublié</h1>
        {sent ? (
          <p className="alert-success mt-4">
            Si un compte existe pour cet email, un lien de réinitialisation vient d&apos;être envoyé.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label>Email</label>
              <input className="input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.com" />
            </div>
            {error && <p className="alert-error">{error}</p>}
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
        )}
        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="link">Retour à la connexion</Link>
        </div>
      </div>
    </main>
  )
}
