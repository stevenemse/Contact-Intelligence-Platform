import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Pattern officiel @supabase/ssr : rafraîchit les tokens de session
 * (cookie sb-* ) à chaque requête, et protège l'espace /app.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api')
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (isApi && isMutation && ((origin && origin !== request.nextUrl.origin) || fetchSite === 'cross-site')) {
    return NextResponse.json({ error: 'Origine de requête invalide' }, { status: 403 })
  }

  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // IMPORTANT : getUser() déclenche le rafraîchissement du token si nécessaire
  const { data: { user } } = await supabase.auth.getUser()

  // Protection des pages uniquement : les /api/* répondent en JSON 401/503,
  // jamais une redirection HTML qui casserait les fetch des composants.
  const isPublic = pathname === '/login' || pathname === '/register' || pathname === '/reset' || pathname === '/'
  if (!isApi && !isPublic && pathname !== '/setup' && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
