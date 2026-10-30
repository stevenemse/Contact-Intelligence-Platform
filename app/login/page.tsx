'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Connexion impossible')
      }
      // La session reste active dans les cookies Supabase : on entre directement
      // dans le tableau de bord (qui renvoie vers /onboarding si aucun espace).
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <div className="brand-mark">CI</div>
        <span>Contact Intelligence Platform</span>
      </Link>

      <div className="auth-card fade-up">
        <h1>Connexion à votre espace</h1>
        <p style={{fontSize:13.5,color:'var(--text-muted)',marginTop:6}}>
          Bienvenue. Entrez vos identifiants pour continuer.
        </p>

        <form onSubmit={onSubmit} style={{marginTop:28,display:'flex',flexDirection:'column',gap:18}}>
          <div>
            <label>Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{paddingRight:42}}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',
                  color:'var(--text-muted)',padding:0,lineHeight:1,
                }}
                aria-label={showPass ? 'Masquer' : 'Afficher'}
              >
                {showPass ? (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}>
                    <path d="M3 3l14 14M7.5 7.5A4.5 4.5 0 0115 12m-2.5 2.5A4.5 4.5 0 015 12c0-1.14.42-2.18 1.1-2.98" strokeLinecap="round"/>
                    <path d="M2 12s3.6-7 8-7c.8 0 1.57.12 2.3.33M18 12s-1.4 3.15-4 5.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}>
                    <path d="M2 12s3.6-7 8-7 8 7 8 7-3.6 7-8 7-8-7-8-7z"/>
                    <circle cx="10" cy="12" r="2.5"/>
                  </svg>
                )}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <Link href="/reset" className="link" style={{ fontSize: 12.5 }}>Mot de passe oublié ?</Link>
            </div>
          </div>

          {error && <p className="alert-error">{error}</p>}

          <button
            className="btn btn-primary"
            disabled={loading}
            style={{width:'100%',justifyContent:'center',padding:'11px',fontSize:14,marginTop:4}}
          >
            {loading ? (
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <svg style={{width:14,height:14,animation:'spin-slow .8s linear infinite'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
                Connexion...
              </span>
            ) : 'Se connecter'}
          </button>
        </form>

        <div style={{marginTop:20,textAlign:'center',fontSize:13,color:'var(--text-muted)'}}>
          Pas encore de compte ?{' '}
          <Link href="/register" className="link">Créer un compte gratuitement</Link>
        </div>
      </div>
    </main>
  )
}
