import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/supabase/server'

function hasPublicConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url && key && !url.includes('VOTRE-') && !key.includes('VOTRE-'))
}

export default function SetupPage() {
  const publicOk = hasPublicConfig()
  const serviceOk = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('VOTRE-'))
  const ok = publicOk && serviceOk && isSupabaseConfigured()

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12">
      <div className="glass-cardauth-card fade-up max-w-2xl space-y-4 text-sm">
        <h1 className="text-2xl font-bold">Configuration requise : Supabase</h1>
        {ok ? (
          <>
            <p className="alert-success">
              Configuration Supabase détectée. Si une erreur persiste, revérifiez les valeurs.
            </p>
            <ul className="space-y-1">
              <li>Projet : <code>{String(process.env.NEXT_PUBLIC_SUPABASE_URL)}</code></li>
              <li>Anon key : <span className="badge badge-green">configurée</span></li>
              <li>Service role key : <span className="badge badge-green">configurée</span></li>
            </ul>
            <Link href="/login" className="btn btn-primary inline-flex">Essayer de se connecter</Link>
          </>
        ) : (
          <>
            <p>
              L&apos;application a besoin des clés Supabase pour démarrer. Elles ne sont pas encore
              déclarées dans <code>.env.local</code>. Suivez ces 5 étapes (compte gratuit) :
            </p>
            <ol className="list-decimal list-inside space-y-2 rounded-xl p-4 leading-relaxed">
              <li>
                Créez un projet sur <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>
                {' '}— nom suggéré : <b>Contact Intelligence</b>.
              </li>
              <li>
                Dans <b>Project Settings → API</b>, copiez l&apos;<b>URL du projet</b> et les clés
                <b> anon</b> et <b>service_role</b>.
              </li>
              <li>
                Dans le <b>SQL Editor</b>, exécutez le script <code>supabase/schema.sql</code>
                {' '}(tables + index + seed) fourni à la racine du projet.
              </li>
              <li>
                Dans <b>Authentication → Providers → Email</b>, activez la connexion e-mail/mot de passe
                (et désactivez « Confirm email » pendant le développement si vous voulez tester tout de suite).
              </li>
              <li>
                Collez les 3 variables dans <code>.env.local</code> :
                <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
                <code>SUPABASE_SERVICE_ROLE_KEY</code> — puis redémarrez <code>npm run dev</code>.
              </li>
            </ol>
            <ul className="text-xs space-y-0.5">
              <li>Auth (email + mot de passe) est géré par Supabase Auth — session via cookies sb-* (HttpOnly).</li>
              <li>Les données sont isolées par <code>organization_id</code> au niveau applicatif (service-role côté serveur).</li>
              <li>La clé service_role ne sort jamais du serveur — jamais exposée au navigateur.</li>
            </ul>
          </>
        )}
      </div>
    </main>
  )
}
