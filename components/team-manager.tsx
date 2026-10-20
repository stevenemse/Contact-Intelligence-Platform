'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; email: string; name: string; role: string; uid: string; createdAt: string }
type Invite = { id: string; email: string; role: string; status: string; createdAt: string }

const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer']

export default function TeamManager({ isAdmin, currentUserId, currentRole, members, invites }: {
  isAdmin: boolean
  currentUserId: string
  currentRole: string
  members: Member[]
  invites: Invite[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Invitations : enregistrement « pending » en base (org_invites).
  // La personne devient membre quand elle est ajoutée avec ce même email
  // par un admin (ou en s'inscrivant, selon le flux choisi).
  async function invite() {
    if (!email.trim()) return
    setBusy(true); setMsg(null)
    try {
      // écrite via l'API admin (vérification du rôle côté serveur)
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })
      const json = res.ok ? await res.json() : await res.json().catch(() => ({}))
      if (!res.ok) setMsg(json.error ?? 'Erreur')
      else { setMsg('Invitation enregistrée. La personne doit s\'inscrire avec ce même email.'); setEmail('') }
      router.refresh()
    } finally { setBusy(false) }
  }

  async function changeRole(memberId: string, newRole: string) {
    // écrit via l'API admin pour vérifier le rôle côté serveur
    const res = await fetch('/api/team/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, newRole }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg(json.error ?? 'Changement impossible')
      return
    }
    router.refresh()
  }

  async function removeMember(memberId: string) {
    if (!confirm('Retirer ce membre de l\'espace ?')) return
    const res = await fetch('/api/team/remove', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg(json.error ?? 'Retrait impossible')
      return
    }
    router.refresh()
  }

  async function revokeInvite(inviteId: string) {
    const res = await fetch('/api/team/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg(json.error ?? 'Annulation impossible')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="glass-card flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">Email à inviter</label>
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">Rôle</label>
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.filter(r => r !== 'owner').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button onClick={invite} disabled={busy} className="btn btn-primary">Inviter</button>
          {msg && <span className="text-sm text-[color:var(--text-primary)]">{msg}</span>}
        </div>
      )}

      <div className="glass-card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 font-bold">Membres ({members.length})</div>
        <table className="data-table">
          <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Depuis</th><th></th></tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td className="font-medium">{m.email || '—'}</td>
                <td>{m.name || '—'}</td>
                <td>
                  {isAdmin && m.uid !== currentUserId ? (
                    <select className="input max-w-[130px] text-xs" value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="badge badge-blue">{m.role}</span>
                  )}
                </td>
                <td className="text-xs text-[color:var(--text-muted)]">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</td>
                <td>
                  {isAdmin && m.role !== 'owner' && m.uid !== currentUserId && (
                    <button onClick={() => removeMember(m.id)} className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--danger)]">retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.filter(i => i.status === 'pending').length > 0 && (
        <div className="glass-card p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2 font-bold">Invitations en attente</div>
          <table className="data-table">
            <thead><tr><th>Email</th><th>Rôle</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {invites.filter(i => i.status === 'pending').map(i => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td><span className="badge">{i.role}</span></td>
                  <td className="text-xs text-[color:var(--text-muted)]">{new Date(i.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    {isAdmin && (
                      <button onClick={() => revokeInvite(i.id)} className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--danger)]">annuler</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
