/**
 * Cycle de vie d'un abonnement, sans Stripe.
 *
 * Un espace reçoit un plan pour une durée définie (mensuel par défaut) :
 * l'échéance vit dans `organizations.current_period_end`. Une fois passée,
 * l'espace repasse au plan gratuit — les données restent, seules les limites
 * et les fonctions du plan s'appliquent à nouveau. Quand Stripe arrivera, son
 * webhook écrira simplement la même colonne : rien à réécrire ici.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Durées proposées au super-admin. */
export const PERIOD_OPTIONS = [
  { months: 1, label: '1 mois (mensuel)' },
  { months: 3, label: '3 mois' },
  { months: 6, label: '6 mois' },
  { months: 12, label: '12 mois' },
] as const

export type SubscriptionRow = {
  plan?: string | null
  subscription_status?: string | null
  current_period_end?: string | null
}

export type SubscriptionState = {
  /** Plan accordé par l'administrateur (ce qui est stocké). */
  plan: string
  /** Plan réellement appliqué : `free` dès que l'échéance est passée. */
  effectivePlan: string
  status: 'free' | 'indefinite' | 'active' | 'expired'
  /** Fin de période (ISO) ; null = pas d'échéance. */
  periodEnd: string | null
  /** Jours restants (0 si expiré ou échu). */
  daysLeft: number | null
}

/**
 * Ajoute des mois à une date en gardant le quantième quand il existe :
 * 31 janvier + 1 mois = 28/29 février (et non le 3 mars).
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

/**
 * Fin de la nouvelle période.
 * Un renouvellement anticipé s'empile sur l'échéance en cours (le client ne
 * perd pas les jours restants) ; sinon la période part de maintenant.
 */
export function nextPeriodEnd(currentEnd: string | null | undefined, months: number, now = new Date()): Date {
  const end = currentEnd ? new Date(currentEnd) : null
  const base = end && !Number.isNaN(end.getTime()) && end.getTime() > now.getTime() ? end : now
  return addMonths(base, months)
}

/** État d'abonnement d'une organisation, calculé à partir de sa ligne. */
export function resolveSubscription(org: SubscriptionRow, now = Date.now()): SubscriptionState {
  const plan = String(org.plan ?? 'free')
  const end = org.current_period_end ? new Date(org.current_period_end) : null
  const valid = end && !Number.isNaN(end.getTime()) ? end : null

  // Le plan gratuit n'expire pas : c'est l'état de repli, pas un abonnement.
  if (plan === 'free') {
    return { plan, effectivePlan: 'free', status: 'free', periodEnd: null, daysLeft: null }
  }
  // Grant historique sans échéance : accordé sans limite de temps.
  if (!valid) {
    return { plan, effectivePlan: plan, status: 'indefinite', periodEnd: null, daysLeft: null }
  }

  const diff = valid.getTime() - now
  const expired = diff <= 0
  return {
    plan,
    effectivePlan: expired ? 'free' : plan,
    status: expired ? 'expired' : 'active',
    periodEnd: valid.toISOString(),
    daysLeft: expired ? 0 : Math.ceil(diff / DAY_MS),
  }
}

/** Libellé court du statut, pour les badges d'interface. */
export function subscriptionLabel(state: SubscriptionState, locale: 'fr' | 'en' = 'fr'): string {
  if (state.status === 'free') return locale === 'fr' ? 'Gratuit' : 'Free'
  if (state.status === 'indefinite') return locale === 'fr' ? 'Illimité' : 'Unlimited'
  if (state.status === 'expired') return locale === 'fr' ? 'Expiré' : 'Expired'
  return locale === 'fr' ? 'Actif' : 'Active'
}
