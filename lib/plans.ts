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

export type PlanFeature = 'imports' | 'duplicates' | 'segments' | 'map' | 'exports' | 'customFields' | 'team' | 'activity'

export const PLANS: Plan[] = [
  { id: 'free',       contacts: 1_000,   seats: 1,   monthly: 0,  yearly: 0,   priceEnv: null },
  { id: 'starter',    contacts: 10_000,  seats: 3,   monthly: 15, yearly: 150, priceEnv: 'STRIPE_PRICE_STARTER' },
  { id: 'business',   contacts: 50_000,  seats: 10,  monthly: 38, yearly: 380, priceEnv: 'STRIPE_PRICE_BUSINESS' },
  { id: 'enterprise', contacts: -1,      seats: -1,  monthly: null, yearly: null, priceEnv: null },
]

export const PLAN_IDS: PlanId[] = ['free', 'starter', 'business', 'enterprise']

const FEATURE_MINIMUM_PLAN: Record<PlanFeature, PlanId> = {
  imports: 'free',
  duplicates: 'free',
  segments: 'starter',
  map: 'starter',
  exports: 'free',
  customFields: 'business',
  team: 'starter',
  activity: 'business',
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, business: 2, enterprise: 3 }

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

/** True when a workspace plan includes a given application capability. */
export function hasPlanFeature(plan: string, feature: PlanFeature): boolean {
  return PLAN_RANK[getPlan(plan).id] >= PLAN_RANK[FEATURE_MINIMUM_PLAN[feature]]
}

export function featureLabel(feature: PlanFeature, locale: 'fr' | 'en' = 'fr'): string {
  const labels: Record<PlanFeature, { fr: string; en: string }> = {
    imports: { fr: 'Imports', en: 'Imports' },
    duplicates: { fr: 'Déduplication', en: 'Deduplication' },
    segments: { fr: 'Segments avancés', en: 'Advanced segments' },
    map: { fr: 'Carte mondiale', en: 'World map' },
    exports: { fr: 'Exports', en: 'Exports' },
    customFields: { fr: 'Champs personnalisés', en: 'Custom fields' },
    team: { fr: 'Équipe', en: 'Team' },
    activity: { fr: 'Historique d’activité', en: 'Activity history' },
  }
  return labels[feature][locale]
}
