import 'server-only'

/**
 * Super-admins de la plateforme (pilotage des abonnements).
 * Liste d'emails séparés par des virgules, modifiable sans redéploiement.
 * Défaut : le propriétaire du produit.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  const list = (process.env.SUPER_ADMIN_EMAILS ?? 'steveemse@gmail.com')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return !!email && list.includes(email.toLowerCase())
}
