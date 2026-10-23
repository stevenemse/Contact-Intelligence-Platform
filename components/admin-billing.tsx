'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS } from '@/lib/plans'

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
}

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green',
  trialing: 'badge-blue',
  manual_grant: 'badge-teal',
  past_due: 'badge-yellow',
  canceled: 'badge-red',
  none: '',
}

export default function AdminBilling({ initialOrgs, myEmail }: { initialOrgs: AdminOrg[]; myEmail: string }) {
  const router = useRouter()
  const [orgs, setOrgs] = useState(initialOrgs)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter(o => o.name.toLowerCase().includes(q) || (o.billingEmail ?? '').toLowerCase().includes(q))
  }, [orgs, query])

  async function changePlan(id: string, plan: string) {
    setBusyId(id); setMsg(null)
    const res = await fetch(`/api/admin/orgs/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    setBusyId(null)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg(json.error ?? 'Erreur')
      return
    }
    setOrgs(list => list.map(o => o.id === id
      ? { ...o, plan, contactQuota: PLANS.find(p => p.id === plan)?.contacts ?? o.contactQuota, subscriptionStatus: plan === 'free' ? 'none' : 'manual_grant' }
      : o))
    setMsg('Plan mis à jour')
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
        <span className="badge">{filtered.length} organisations</span>
        {msg && <span className="badge badge-green">{msg}</span>}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>Connecté : {myEmail}</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Organisation</th><th>Plan</th><th>Statut</th><th>Contacts</th><th>Période</th><th>Changer le plan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.billingEmail ?? '—'}{o.hasStripe ? ' · Stripe ✓' : ''}</div>
                </td>
                <td><span className="badge badge-teal">{o.plan}</span></td>
                <td><span className={`badge ${STATUS_BADGE[o.subscriptionStatus] ?? ''}`}>{o.subscriptionStatus}</span></td>
                <td>
                  {o.contactCount.toLocaleString('fr-FR')}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}> / {o.contactQuota.toLocaleString('fr-FR')}</span>
                  <div className="progress-bar" style={{ marginTop: 4, width: 90 }}>
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.round((o.contactCount / Math.max(1, o.contactQuota)) * 100))}%` }} />
                  </div>
                </td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {o.currentPeriodEnd ? new Date(o.currentPeriodEnd).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td>
                  <select
                    className="input btn-xs"
                    style={{ width: 150 }}
                    value={o.plan}
                    disabled={busyId === o.id}
                    onChange={e => changePlan(o.id, e.target.value)}
                    aria-label={`Changer le plan de ${o.name}`}
                  >
                    {PLANS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-faint)' }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
