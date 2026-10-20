// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str } from '@/lib/supabase/helpers'
import { fmtDate } from '@/lib/supabase/page-data'
import TeamManager from '@/components/team-manager'

export default async function TeamPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let members: { id: string; email: string; name: string; role: string; uid: string; createdAt: string }[] = []
  let invites: { id: string; email: string; role: string; status: string; createdAt: string }[] = []
  if (db) {
    const [memRes, invRes] = await Promise.all([
      db.from('memberships').select('id, user_id, email, name, role, created_at')
        .eq('organization_id', ctx.orgId).order('created_at', { ascending: true }),
      db.from('org_invites').select('id, email, role, status, created_at')
        .eq('organization_id', ctx.orgId).order('created_at', { ascending: false }),
    ])
    members = ((memRes.data ?? []) as unknown as Record<string, unknown>[]).map(m => ({
      id: str(m.id),
      email: str(m.email),
      name: str(m.name),
      role: str(m.role),
      uid: str(m.user_id),
      createdAt: fmtDate(str(m.created_at)),
    }))
    invites = ((invRes.data ?? []) as unknown as Record<string, unknown>[]).map(i => ({
      id: str(i.id),
      email: str(i.email),
      role: str(i.role),
      status: str(i.status),
      createdAt: fmtDate(str(i.created_at)),
    }))
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Équipe</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Membres de {ctx.orgName} et permissions (owner, admin, manager, member, viewer).
        </p>
      </div>
      <TeamManager
        isAdmin={ctx.role === 'owner' || ctx.role === 'admin'}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
        members={members}
        invites={invites}
      />
    </div>
  )
}
