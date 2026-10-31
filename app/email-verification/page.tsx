'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EmailVerificationPage() {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vérifier si l'utilisateur vient de s'inscrire (via query param)
  useEffect(() => {
    const params = new URLSearchParams(new URL(window.location.href).search)
    const justRegistered = params.get('just_registered') === 'true'
    if (justRegistered) {
      setSent(true)
    }
  }, [])

  const resend = async () => {
    setError(null)
    setSent(false)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.ok) {
        setSent(true)
      } else {
        setError(data.error || 'Impossible de renvoyer l\'email')
      }
    } catch (e) {
      setError('Erreur lors du renvoi')
    }
  }

  // Contenu principal
  const content = (
    <div className="glass-card auth-card fade-up max-w-md">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {sent ? (
          <>
            <svg
              width="80"
              height="80"
              style={{ margin: '0 auto 16px', color: 'var(--success)' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path d="M22 11.08V12a4.958 4.958 0 0 1-3.32 1.83l-.17.02C18.88 16.1 16.33 18 13 18s-5.88-1.9-7.91-5.09l-.17-.02A4.958 4.958 0 0 1 2 11.08v.02C2 7.55 4.55 5 8 5c1.36 0 2.61.28 3.71.76l-.17.02C3.64 3.84 5.25 5 7 5c1.99 0 3.77.87 5.04 2.31l.17.02c-.5 1.46-.89 2.96-1.15 4.44l-.17.02a4.956 4.956 0 0 1-1.32 1.83V12z" />
              <path d="M7 10l5 5" />
            </svg>
            <h2>Email de confirmation envoyé !</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '8px 0 20px' }}>
              Un email de vérification a été envoyé à votre adresse. Vérifiez votre boîte de réception (et les spams) pour cliquer sur le lien.
            </p>
            <button onClick={resend} className="btn btn-secondary mt-4" style={{ marginTop: 12, width: '100%' }}>
              🔁 Renvoyer l'email
            </button>
          </>
        ) : (
          <>
            <svg
              width="80"
              height="80"
              style={{ margin: '0 auto 16px', color: 'var(--warning)' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path d="M22 11.08V12a4.958 4.958 0 0 1-3.32 1.83l-.17.02C18.88 16.1 16.33 18 13 18s-5.88-1.9-7.91-5.09l-.17-.02A4.958 4.958 0 0 1 2 11.08v.02C2 7.55 4.55 5 8 5c1.36 0 2.61.28 3.71.76l-.17.02C3.64 3.84 5.25 5 7 5c1.99 0 3.77.87 5.04 2.31l.17.02c-.5 1.46-.89 2.96-1.15 4.44l-.17.02a4.956 4.956 0 0 1-1.32 1.83V12z" />
              <path d="M7 10l5 5" />
            </svg>
            <h2>Vérification email requise</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '8px 0 20px' }}>
              Pour sécuriser votre compte, veuillez vérifier votre email. Un message a été envoyé lors de votre inscription.
            </p>
            <button onClick={resend} className="btn btn-primary mt-4">
              🔁 Renvoyer l'email
            </button>
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--text-faint)' }}>
              <p>Si vous n'avez pas reçu d'email :</p>
              <ul style={{ textAlign: 'left', maxWidth: 200, margin: '0 auto' }}>
                <li>Vérifiez vos spams ou courriers indésirables</li>
                <li>Assurez-vous que l'email est correct</li>
                <li>Cliquez sur "Renvoyer l'email" ci-dessus</li>
              </ul>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        {sent ? (
          <p style={{ color: 'var(--success)' }}>✅ Vérifié ! Vous pouvez maintenant vous connecter.</p>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>📧 Vérifiez votre boîte mail pour activer votre compte.</p>
        )}
        <br />
        <button
          onClick={() => router.push('/login')}
          className="btn btn-link mt-4"
          style={{ marginTop: 8, fontSize: 13 }}
        >
          Retourner à la page de connexion
        </button>
      </div>
    </div>
  )

  return (
    <main className="auth-page">
      {content}
    </main>
  )
}