'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { PLANS, isPaidPlan } from '@/lib/plans'
import { subscriptionLabel, type SubscriptionState } from '@/lib/billing/subscription'

const STATUS_BADGE: Record<SubscriptionState['status'], string> = {
  active: 'badge-green',
  indefinite: 'badge-teal',
  expired: 'badge-red',
  free: '',
}

export default function BillingPanel({ canManage, quota, subscription, hasStripeCustomer, stripeEnabled, flag }: {
  canManage: boolean
  quota: number
  /** État calculé côté serveur : plan effectif, échéance et jours restants. */
  subscription: SubscriptionState
  hasStripeCustomer: boolean
  /** Faux tant que STRIPE_SECRET_KEY n'est pas configurée : pas de checkout. */
  stripeEnabled: boolean
  flag: 'success' | 'canceled' | null
}) {
  const { t } = useI18n()
  const b = t.billing
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const effectivePlan = subscription.effectivePlan
  const state = subscription.status
  const periodEndLabel = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
    : null

  async function checkout(plan: string) {
    setBusy(plan); setMsg(null)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    setBusy(null)
    const json = await res.json().catch(() => ({}))
    if (json.url) { window.location.assign(json.url); return }
    setMsg(json.error ?? t.common.error)
  }

  async function portal() {
    setBusy('portal'); setMsg(null)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    setBusy(null)
    const json = await res.json().catch(() => ({}))
    if (json.url) { window.location.assign(json.url); return }
    setMsg(json.error ?? t.common.error)
  }

  return (
    <div className="space-y-4">
      {flag === 'success' && <div className="alert-success">{b.success}</div>}
      {flag === 'canceled' && <div className="alert-warning">{b.canceled}</div>}
      {msg && <div className="alert-error">{msg}</div>}

      {state === 'expired' && (
        <div className="alert-error">
          {b.subExpired} {periodEndLabel}. {b.subExpiredHint}
        </div>
      )}

      <div className="kpi-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.currentPlan}</p>
            <p className="title-bloc" style={{ textTransform: 'capitalize' }}>{effectivePlan}</p>
          </div>
          <span className={`badge ${STATUS_BADGE[state] ?? ''}`}>{subscriptionLabel(subscription)}</span>
        </div>
        <div className="text-sm flex gap-6 flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <span>{b.quota} : <b style={{ color: 'var(--text-primary)' }}>{quota < 0 ? 'illimité' : quota.toLocaleString('fr-FR')}</b></span>
          {state === 'active' && periodEndLabel && (
            <span>
              {b.subEnds} <b style={{ color: 'var(--text-primary)' }}>{periodEndLabel}</b>
              {' · '}{subscription.daysLeft} {b.daysLeft}
            </span>
          )}
        </div>
        {state === 'indefinite' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.subIndefinite}</p>
        )}
        {state === 'free' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.subFree}</p>
        )}
        {canManage && hasStripeCustomer && stripeEnabled && (
          <button onClick={portal} disabled={busy === 'portal'} className="btn btn-ghost btn-sm">
            {b.manage}
          </button>
        )}
      </div>

      <div className="kpi-card space-y-3">
        <p className="section-title" style={{ marginBottom: 0 }}>{b.upgrade}</p>
        {PLANS.filter(p => isPaidPlan(p.id)).map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border-soft)' }}>
            <div>
              <b className="text-sm" style={{ textTransform: 'capitalize' }}>{p.id}</b>
              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                {p.contacts.toLocaleString('fr-FR')} {t.pricing.contactsLabel} · {p.monthly} €{t.pricing.perMonth}
              </span>
            </div>
            {effectivePlan === p.id ? (
              <span className="badge badge-green">{b.currentPlan}</span>
            ) : stripeEnabled ? (
              <button onClick={() => checkout(p.id)} disabled={!canManage || busy === p.id} className="btn btn-primary btn-sm">
                {b.changePlan}
              </button>
            ) : (
              <span className="badge">{p.monthly} €{t.pricing.perMonth}</span>
            )}
          </div>
        ))}
        {!stripeEnabled && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.manualNote}</p>
        )}
        {stripeEnabled && !hasStripeCustomer && (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{b.noSub}</p>
        )}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link href="/pricing" className="link">{t.pricing.title} →</Link>
        </p>
      </div>
    </div>
  )
}
