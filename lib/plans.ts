/**
 * Source unique des plans du SaaS.
 * contacts/seats : -1 = illimité · monthly/yearly en euros · null = sur devis.
 */
export type PlanId = 'free' | 'starter' | 'business' | 'enterprise'

export type Plan = {
  id: PlanId
  contacts: number
  seats: number
  monthly: number | null
  yearly: number | null
  /** Variable d'environnement du Price Stripe mensuel (null = pas de checkout). */
  priceEnv: string | null
}

export const PLANS: Plan[] = [
  { id: 'free',       contacts: 1_000,   seats: 1,   monthly: 0,  yearly: 0,   priceEnv: null },
  { id: 'starter',    contacts: 10_000,  seats: 3,   monthly: 15, yearly: 150, priceEnv: 'STRIPE_PRICE_STARTER' },
  { id: 'business',   contacts: 50_000,  seats: 10,  monthly: 38, yearly: 380, priceEnv: 'STRIPE_PRICE_BUSINESS' },
  { id: 'enterprise', contacts: -1,      seats: -1,  monthly: null, yearly: null, priceEnv: null },
]

export const PLAN_IDS: PlanId[] = ['free', 'starter', 'business', 'enterprise']

export function getPlan(id: string): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0]
}

/** Quota de contacts appliqué pour un plan (utilisé par les gardes d'import). */
export function quotaForPlan(id: string): number {
  return getPlan(id).contacts
}

export function isPaidPlan(id: string): boolean {
  return id === 'starter' || id === 'business'
}
