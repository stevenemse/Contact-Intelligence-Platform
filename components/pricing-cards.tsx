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

const euro = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })

export default function PricingCards({ currentPlan }: { currentPlan?: string | null }) {
  const { t } = useI18n()
  const p = t.pricing
  const [yearly, setYearly] = useState(false)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 999, padding: 4, gap: 4 }}>
          <button onClick={() => setYearly(false)} className={`btn btn-sm ${!yearly ? 'btn-primary' : 'btn-ghost'}`}>{p.monthly}</button>
          <button onClick={() => setYearly(true)} className={`btn btn-sm ${yearly ? 'btn-primary' : 'btn-ghost'}`}>
            {p.yearly} · <span style={{ opacity: .85 }}>{p.save}</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
        {PLANS.map(plan => {
          const price = yearly ? plan.yearly : plan.monthly
          const features = FEATURES_BY_PLAN[plan.id]
          return (
            <div key={plan.id} className="kpi-card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 360 }}>
              {plan.id === 'starter' && (
                <span className="badge badge-teal" style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)' }}>{p.popular}</span>
              )}
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{p[plan.id].name}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, minHeight: 36 }}>{p[plan.id].desc}</p>
              <div>
                {price === null ? (
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{p.contact}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)' }}>{price === 0 ? '0 €' : `${euro(price)} €`}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{yearly ? p.perYear : p.perMonth}</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {plan.contacts < 0 ? `∞ ${p.contactsLabel}` : `${plan.contacts.toLocaleString('fr-FR')} ${p.contactsLabel}`}
                {' · '}
                {plan.seats < 0 ? `∞ ${p.seats}` : `${plan.seats} ${p.seats}`}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6, flex: 1 }}>
                {features.map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span> {p.features[f as keyof typeof p.features]}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 12 }}>
                {currentPlan === plan.id ? (
                  <span className="badge badge-green" style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</span>
                ) : plan.id === 'enterprise' ? (
                  <Link href="/register?plan=enterprise" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>{p.contact}</Link>
                ) : (
                  <Link href={`/register?plan=${plan.id}`} className={`btn ${plan.id === 'starter' ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '100%', justifyContent: 'center' }}>
                    {plan.id === 'free' ? p.noCard : p.cta}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ maxWidth: 720, margin: '56px auto 0' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 16 }}>{p.faqTitle}</h2>
        {([['faq1q', 'faq1a'], ['faq2q', 'faq2a'], ['faq3q', 'faq3a']] as const).map(([q, a]) => (
          <details key={q} style={{ borderBottom: '1px solid var(--border)', padding: '12px 4px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{p[q]}</summary>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>{p[a]}</p>
          </details>
        ))}
      </div>
    </>
  )
}
