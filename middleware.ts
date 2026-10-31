import { NextResponse, type NextRequest } from 'next/server'

// Store request timestamps per IP for rate limiting
const requestTimers: Map<string, number[]> = new Map()

// Seuil de taux: 50 requêtes par 15 minutes par IP
const MAX_REQUESTS = 50
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getClientIp(request: NextRequest): string {
  // Essayer d'obtenir l'IP depuis les headers X-Forwarded-For (proxies/Cloudflare)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // X-Forwarded-For peut contenir plusieurs IPs, on prend le premier (le plus proche)
    const ip = forwardedFor.split(',')[0].trim()
    if (ip) return ip
  }
  // Fallback : on utilise 'origin-based' comme clé de limitation
  return 'origin-based'
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const timestamps = requestTimers.get(ip) || []

  // Nettoyer les timestamps en dehors de la fenêtre
  const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS)

  // Mettre à jour avec seulement les timestamps valides
  requestTimers.set(ip, validTimestamps)

  // Vérifier si on dépasse la limite
  if (validTimestamps.length >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  // Ajouter le timestamp actuel
  validTimestamps.push(now)
  requestTimers.set(ip, validTimestamps)

  return { allowed: true, remaining: MAX_REQUESTS - validTimestamps.length }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Appliquer le rate limiting sur les routes sensibles
  const sensitiveRoutes = [
    '/api/auth/login',
    '/api/imports',
    '/api/contact/recaptcha',
  ]

  const isSensitiveRoute = sensitiveRoutes.some(route => pathname.startsWith(route))

  if (isSensitiveRoute) {
    const ip = getClientIp(request)
    const { allowed, remaining } = checkRateLimit(ip)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez réessayer dans 15 minutes.' },
        { status: 429 }
      )
    }

    // Ajouter des headers informatifs
    const response = NextResponse.next()
    response.headers.set('x-rate-limit-limit', MAX_REQUESTS.toString())
    response.headers.set('x-rate-limit-remaining', remaining.toString())
    response.headers.set('x-rate-limit-reset', Math.ceil(WINDOW_MS / 1000).toString())
    return response
  }

  const response = NextResponse.next()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
