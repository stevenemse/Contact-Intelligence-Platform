'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { PLANS, isPaidPlan } from '@/lib/plans'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green',
  trialing: 'badge-blue',
  manual_grant: 'badge-teal',
  past_due: 'badge-yellow',
  canceled: 'badge-red',
  none: '',
}

export default function BillingPanel({ canManage, currentPlan, quota, subscriptionStatus, currentPeriodEnd, hasStripeCustomer, flag }: {
  canManage: boolean
  currentPlan: string
  quota: number
  subscriptionStatus: string
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
  flag: 'success' | 'canceled' | null
}) {
  const { t } = useI18n()
  const b = t.billing
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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

      <div className="kpi-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.currentPlan}</p>
            <p className="title-bloc" style={{ textTransform: 'capitalize' }}>{currentPlan}</p>
          </div>
          <span className={`badge ${STATUS_BADGE[subscriptionStatus] ?? ''}`}>{subscriptionStatus}</span>
        </div>
        <div className="text-sm flex gap-6 flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <span>{b.quota} : <b style={{ color: 'var(--text-primary)' }}>{quota.toLocaleString('fr-FR')}</b></span>
          {currentPeriodEnd && (
            <span>{b.periodEnd} : <b style={{ color: 'var(--text-primary)' }}>{new Date(currentPeriodEnd).toLocaleDateString('fr-FR')}</b></span>
          )}
        </div>
        {canManage && hasStripeCustomer && (
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
            {currentPlan === p.id ? (
              <span className="badge badge-green">{b.currentPlan}</span>
            ) : (
              <button onClick={() => checkout(p.id)} disabled={!canManage || busy === p.id} className="btn btn-primary btn-sm">
                {b.changePlan}
              </button>
            )}
          </div>
        ))}
        {!hasStripeCustomer && subscriptionStatus !== 'manual_grant' && (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{b.noSub}</p>
        )}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link href="/pricing" className="link">{t.pricing.title} →</Link>
        </p>
      </div>
    </div>
  )
}
