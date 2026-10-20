import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

type ServiceClient = SupabaseClient

/** URL + clé anon (publics). Absentes tant que l'utilisateur n'a pas connecté le projet. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
/** Clé service_role (SECÈTE, serveur uniquement) : bypass RLS, l'autorisation est faite applicativement. */
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(
    url && anonKey && serviceKey &&
    !url.includes('VOTRE-') && SUPABASE_KEYS_PLACEHOLDER.every(k => !serviceKey.includes(k))
  )
}

const SUPABASE_KEYS_PLACEHOLDER = ['VOTRE-']

/** Client SSR : lit/écrit les cookies de session Supabase (pattern @supabase/ssr). */
export async function createSsrClient(): Promise<SupabaseClient | null> {
  // placeholders « VOTRE-... » → assimilé à non configuré (messages 503 clairs)
  if (!url || !anonKey || url.includes('VOTRE-') || anonKey.includes('VOTRE-')) return null
  const store = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options)
        } catch {
          // appelé depuis un Server Component : le middleware rafraîchira la session
        }
      },
    },
  })
}

/** Client service-role pour les accès base de données (aucune RLS, autorisation applicative). */
export function serviceDb(): ServiceClient | null {
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  })
}

/**
 * Combine auth utilisateur (via client SSR) + client service-role pour les données.
 * Renvoie l'utilisateur courant ou null.
 */
export async function getAuthUser(): Promise<{ id: string; email: string; name: string | null } | null> {
  const ssr = await createSsrClient()
  if (ssr) {
    const { data: { user } } = await ssr.auth.getUser()
    if (user) {
      return {
        id: user.id,
        email: user.email ?? '',
        name: (user.user_metadata?.full_name as string) ?? null,
      }
    }
  }
  // fallback : middleware a peut-être rafraîchi/titré le cookie
  return null
}

/** Extraire les messages d'erreur plausibles de la librairie js. */
export function supaErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Erreur inconnue'
}
