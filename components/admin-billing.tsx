'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, ENTERPRISE_TIERS, ENTERPRISE_MAX_QUOTA } from '@/lib/plans'
import {
  PERIOD_OPTIONS,
  resolveSubscription,
  subscriptionLabel,
  type SubscriptionState,
} from '@/lib/billing/subscription'

export type AdminOrg = {
  id: string
  name: string
  plan: string
  contactQuota: number
  subscriptionStatus: string
  currentPeriodEnd: string | null
  hasStripe: boolean
  billingEmail: string | null
  contactCount: number
  /** État calculé côté serveur (échéance déjà comparée à maintenant). */
  subscription: SubscriptionState
}

/** Comptages plateforme exacts (lecture serveur, indépendants de la liste des orgs). */
export type AdminStats = {
  orgs: number
  orgsNew: number
  accounts: number
  accountsNew: number
  contacts: number
  imports: number
  exports: number
}

/** Adhésion récente (liste « comptes créés récemment »). */
export type RecentAccount = {
  email: string
  name: string | null
  role: string
  orgName: string
  orgPlan: string
  createdAt: string
}

type Filter = 'all' | 'active' | 'expiring' | 'expired'

const BADGE: Record<SubscriptionState['status'], string> = {
  active: 'badge-green',
  indefinite: 'badge-teal',
  expired: 'badge-red',
  free: '',
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—'
}

/**
 * Contrôle commercial des espaces : plan + durée d'attribution (mensuel par
 * défaut). L'échéance est la seule source de vérité ; le siège de l'abonnement
 * (Stripe) viendra plus tard sans changer cette interface.
 */
export default function AdminBilling({ initialOrgs, myEmail }: { initialOrgs: AdminOrg[]; myEmail: string }) {
  const router = useRouter()
  const [orgs, setOrgs] = useState(initialOrgs)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Durée choisie par organisation ; 1 mois = mensuel, la valeur par défaut.
  const [monthsById, setMonthsById] = useState<Record<string, number>>({})
  // Quota Enterprise choisi par organisation : palier, personnalisé (0) ou -1.
  const [quotaChoice, setQuotaChoice] = useState<Record<string, number>>({})
  const [customQuota, setCustomQuota] = useState<Record<string, string>>({})
  // Plan en cours de choix (draft) : l'attribution part du bouton, pas du select.
  const [planById, setPlanById] = useState<Record<string, string>>({})

  /** Choix par défaut coherent avec le quota déjà stocké sur l'organisation. */
  function defaultChoice(org: AdminOrg): number {
    if (org.contactQuota === -1) return -1
    const tier = ENTERPRISE_TIERS.find(t => t.value === org.contactQuota)
    return tier ? tier.value : 0
  }

  /**
   * Quota qui accompagnera l'attribution : celui du plan, ou pour enterprise
   * le palier choisi (valeur personnalisée validée entre 1 000 et le plafond).
   */
  function chosenQuota(org: AdminOrg, plan: string): number {
    if (plan !== 'enterprise') return PLANS.find(p => p.id === plan)?.contacts ?? org.contactQuota
    const choice = quotaChoice[org.id] ?? defaultChoice(org)
    if (choice === -1) return -1
    if (choice === 0) {
      const n = parseInt(customQuota[org.id] ?? '', 10)
      return Number.isFinite(n) && n >= 1_000 ? n : NaN
    }
    return choice
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orgs.filter(o => {
      const state = o.subscription.status
      if (filter === 'active' && state !== 'active' && state !== 'indefinite') return false
      if (filter === 'expiring' && !(state === 'active' && (o.subscription.daysLeft ?? 99) <= 7)) return false
      if (filter === 'expired' && state !== 'expired') return false
      if (!q) return true
      return o.name.toLowerCase().includes(q) || (o.billingEmail ?? '').toLowerCase().includes(q)
    })
  }, [orgs, query, filter])

  const counts = useMemo(() => ({
    active: orgs.filter(o => o.subscription.status === 'active' || o.subscription.status === 'indefinite').length,
    expiring: orgs.filter(o => o.subscription.status === 'active' && (o.subscription.daysLeft ?? 99) <= 7).length,
    expired: orgs.filter(o => o.subscription.status === 'expired').length,
  }), [orgs])

  async function submit(id: string, plan: string, months: number, org: AdminOrg) {
    const contacts = chosenQuota(org, plan)
    if (plan === 'enterprise' && !Number.isFinite(contacts)) {
      setMsg('Quota Enterprise personnalisé : entrez une valeur (minimum 1 000 contacts).')
      return
    }
    setBusyId(id); setMsg(null)
    const res = await fetch(`/api/admin/orgs/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, months, contacts }),
    })
    setBusyId(null)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error ?? `Erreur ${res.status}`)
      return
    }
    const periodEnd: string | null = json.currentPeriodEnd ?? null
    setPlanById(m => ({ ...m, [id]: plan }))
    setOrgs(list => list.map(o => o.id === id ? {
      ...o,
      plan,
      contactQuota: Number.isFinite(contacts) ? contacts : o.contactQuota,
      subscriptionStatus: plan === 'free' ? 'none' : 'active',
      currentPeriodEnd: periodEnd,
      subscription: resolveSubscription({ plan, current_period_end: periodEnd }),
    } : o))
    setMsg(plan === 'free'
      ? 'Abonnement arrêté — espace repassé en gratuit'
      : `Plan ${plan} accordé jusqu'au ${fmtDate(periodEnd)}`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="Rechercher une organisation…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {([
          ['all', `Toutes (${orgs.length})`],
          ['active', `À jour (${counts.active})`],
          ['expiring', `Expirent sous 7 j (${counts.expiring})`],
          ['expired', `Expirées (${counts.expired})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`btn btn-xs ${filter === key ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={filter === key}
          >
            {label}
          </button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>Connecté : {myEmail}</span>
      </div>
      {msg && <div className="alert-success">{msg}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Abonnement</th>
              <th>Contacts</th>
              <th>Accordé jusqu&apos;au</th>
              <th>Plan &amp; durée</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const s = o.subscription
              const months = monthsById[o.id] ?? 1
              const busy = busyId === o.id
              const soon = s.status === 'active' && (s.daysLeft ?? 99) <= 7
              const selectedPlan = planById[o.id] ?? o.plan
              const entChoice = quotaChoice[o.id] ?? defaultChoice(o)
              return (
                <tr key={o.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {o.billingEmail ?? '—'}{o.hasStripe ? ' · Stripe ✓' : ''}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${BADGE[s.status]}`}>{subscriptionLabel(s)}</span>
                    <span className="badge badge-teal ml-1">{o.plan}</span>
                    {s.status === 'active' && (
                      <div className="text-xs mt-1" style={{ color: soon ? 'var(--warning, #b45309)' : 'var(--text-muted)' }}>
                        {s.daysLeft} jour{s.daysLeft === 1 ? '' : 's'} restant{s.daysLeft === 1 ? '' : 's'}
                      </div>
                    )}
                    {s.status === 'expired' && (
                      <div className="text-xs mt-1" style={{ color: 'var(--danger, #b91c1c)' }}>
                        Échu — espace en plan gratuit
                      </div>
                    )}
                    {s.status === 'indefinite' && (
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Sans échéance</div>
                    )}
                  </td>
                  <td>
                    {o.contactCount.toLocaleString('fr-FR')}
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {' / '}{o.contactQuota < 0 ? 'illimité' : o.contactQuota.toLocaleString('fr-FR')}
                    </span>
                    {o.contactQuota > 0 && (
                      <div className="progress-bar" style={{ marginTop: 4, width: 90 }}>
                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.round((o.contactCount / o.contactQuota) * 100))}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(s.periodEnd)}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="input btn-xs"
                        style={{ width: 118 }}
                        value={selectedPlan}
                        disabled={busy}
                        onChange={e => setPlanById(m => ({ ...m, [o.id]: e.target.value }))}
                        aria-label={`Plan de ${o.name}`}
                      >
                        {PLANS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                      </select>
                      {selectedPlan === 'enterprise' && (
                        <span className="flex flex-wrap items-center gap-1">
                          <select
                            className="input btn-xs"
                            style={{ width: 118 }}
                            value={entChoice}
                            disabled={busy}
                            onChange={e => setQuotaChoice(m => ({ ...m, [o.id]: Number(e.target.value) }))}
                            aria-label={`Palier de contacts pour ${o.name}`}
                          >
                            {ENTERPRISE_TIERS.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          {entChoice === 0 && (
                            <input
                              type="number"
                              className="input btn-xs"
                              style={{ width: 108 }}
                              min={1_000}
                              max={ENTERPRISE_MAX_QUOTA}
                              step={1_000}
                              placeholder="ex. 250000"
                              value={customQuota[o.id] ?? ''}
                              disabled={busy}
                              onChange={e => setCustomQuota(m => ({ ...m, [o.id]: e.target.value }))}
                              aria-label={`Quota personnalisé pour ${o.name}`}
                            />
                          )}
                        </span>
                      )}
                      <select
                        className="input btn-xs"
                        style={{ width: 132 }}
                        value={months}
                        disabled={busy || o.plan === 'free'}
                        onChange={e => setMonthsById(m => ({ ...m, [o.id]: Number(e.target.value) }))}
                        aria-label={`Durée d'attribution pour ${o.name}`}
                      >
                        {PERIOD_OPTIONS.map(p => <option key={p.months} value={p.months}>{p.label}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        disabled={busy || selectedPlan === 'free'}
                        onClick={() => submit(o.id, selectedPlan, months, o)}
                      >
                        {s.status === 'expired' ? 'Renouveler' : s.status === 'active' && selectedPlan === o.plan ? 'Prolonger' : 'Accorder'}
                      </button>
                      {o.plan !== 'free' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={busy}
                          onClick={() => submit(o.id, 'free', 0, o)}
                        >
                          Arrêter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-faint)' }}>Aucune organisation</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Une prolongation pendant la période en cours s&apos;ajoute à l&apos;échéance existante.
        À l&apos;échéance, l&apos;espace repasse automatiquement en plan gratuit (données conservées).
      </p>
    </div>
  )
}
