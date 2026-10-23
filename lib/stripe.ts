import Stripe from 'stripe'

let client: Stripe | null = null

/** Client Stripe côté serveur ; null tant que STRIPE_SECRET_KEY n'est pas définie. */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY)
  return client
}
