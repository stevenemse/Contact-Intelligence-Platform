'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { PLANS, type PlanId } from '@/lib/plans'

const FEATURES_BY_PLAN: Record<PlanId, string[]> = {
  free: ['import', 'dedupe'],
  starter: ['import', 'dedupe', 'segments', 'map'],
  business: ['import', 'dedupe', 'segments', 'map', 'fields', 'priority'],
  enterprise: ['import', 'dedupe', 'segments', 'map', 'fields', 'priority', 'sso', 'onboarding'],
}

const euro = (n: number, locale: string) => n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-IE', { maximumFractionDigits: 0 })

export default function PricingCards({ currentPlan }: { currentPlan?: string | null }) {
  const { locale, t } = useI18n()
  const p = t.pricing
  const [yearly, setYearly] = useState(false)
  const authenticated = Boolean(currentPlan)

  return (
    <>
      <div className="pricing-toggle">
        <div className="pricing-toggle-inner">
          <button type="button" onClick={() => setYearly(false)} className={`btn btn-sm ${!yearly ? 'btn-primary' : 'btn-ghost'}`}>{p.monthly}</button>
          <button type="button" onClick={() => setYearly(true)} className={`btn btn-sm ${yearly ? 'btn-primary' : 'btn-ghost'}`}>
            {p.yearly} · <span style={{ opacity: .85 }}>{p.save}</span>
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        {PLANS.map(plan => {
          const name = p[plan.id].name
          const price = yearly ? plan.yearly : plan.monthly
          const features = FEATURES_BY_PLAN[plan.id]
          const actionHref = authenticated
            ? plan.id === 'enterprise' ? 'mailto:contact@contactintelligence.app?subject=Plan%20Entreprise' : '/settings/billing'
            : `/register?plan=${plan.id}`
          return (
            <article key={plan.id} className={`kpi-card pricing-card${plan.id === 'starter' ? ' pricing-card-featured' : ''}`}>
              {plan.id === 'starter' && (
                <span className="badge badge-teal pricing-popular">{p.popular}</span>
              )}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0', minHeight: 42, lineHeight: 1.5 }}>{p[plan.id].desc}</p>
              </div>
              <div className="pricing-price">
                {price === null ? (
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{p.contact}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)' }}>{price === 0 ? '0 €' : `${euro(price, locale)} €`}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{yearly ? p.perYear : p.perMonth}</span>
                  </>
                )}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                {plan.contacts < 0 ? `∞ ${p.contactsLabel}` : `${plan.contacts.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${p.contactsLabel}`}
                {' · '}
                {plan.seats < 0 ? `∞ ${p.seats}` : `${plan.seats} ${p.seats}`}
              </p>
              <ul className="pricing-feature-list">
                {features.map(f => (
                  <li key={f}>
                    <span aria-hidden="true">✓</span> {p.features[f as keyof typeof p.features]}
                  </li>
                ))}
              </ul>
              {currentPlan === plan.id ? (
                <span className="badge badge-green pricing-current-plan">{locale === 'fr' ? 'Plan actuel' : 'Current plan'}</span>
              ) : (
                <Link href={actionHref} className={`btn ${plan.id === 'starter' ? 'btn-primary' : 'btn-ghost'} pricing-action`}>
                  {plan.id === 'enterprise' ? p.contact : plan.id === 'free' ? p.noCard : authenticated ? (locale === 'fr' ? 'Mettre à niveau' : 'Upgrade') : p.cta}
                </Link>
              )}
            </article>
          )
        })}
      </div>

      <div className="pricing-faq">
        <h2>{p.faqTitle}</h2>
        {([['faq1q', 'faq1a'], ['faq2q', 'faq2a'], ['faq3q', 'faq3a']] as const).map(([q, a]) => (
          <details key={q}>
            <summary>{p[q]}</summary>
            <p>{p[a]}</p>
          </details>
        ))}
      </div>
    </>
  )
}
