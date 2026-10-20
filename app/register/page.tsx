'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'


function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['var(--danger)', 'var(--warning)', 'var(--brand)', 'var(--success)']
  const labels = ['Faible', 'Moyen', 'Fort', 'Très fort']
  if (!password) return null
  return (
    <div style={{marginTop:8}}>
      <div style={{display:'flex',gap:4,marginBottom:4}}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex:1, height:3, borderRadius:99,
            background: i < score ? colors[score - 1] : 'var(--border)',
            transition:'background .3s',
          }}/>
        ))}
      </div>
      <span style={{fontSize:11,color: score > 0 ? colors[score - 1] : 'var(--text-muted)'}}>
        {score > 0 ? labels[score - 1] : ''}
      </span>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Création du compte impossible')
      }
      router.push('/onboarding')
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
        <h1>Créer votre compte</h1>
        <p style={{fontSize:13.5,color:'var(--text-muted)',marginTop:6}}>
          Quelques secondes suffisent · Gratuit pour toujours
        </p>

        <form onSubmit={onSubmit} style={{marginTop:28,display:'flex',flexDirection:'column',gap:18}}>
          <div>
            <label>Nom complet</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Prénom Nom"
              autoComplete="name"
            />
          </div>

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
            <div style={{position:'relative'}}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
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
            <PasswordStrength password={password} />
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
                Création...
              </span>
            ) : 'Créer mon compte'}
          </button>

          <p style={{fontSize:11.5,color:'var(--text-muted)',textAlign:'center',marginTop:-4}}>
            En créant un compte, vous acceptez nos conditions d&apos;utilisation.
          </p>
        </form>

        <div style={{marginTop:20,textAlign:'center',fontSize:13,color:'var(--text-muted)'}}>
          Déjà un compte ?{' '}
          <Link href="/login" className="link">Se connecter</Link>
        </div>
      </div>
    </main>
  )
}
