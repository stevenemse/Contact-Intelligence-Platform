import 'server-only'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getAuthUser, serviceDb } from './server'
import { quotaForPlan } from '@/lib/plans'

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

export type OrgCtx = {
  userId: string
  email: string
  orgId: string
  orgName: string
  orgPlan: string
  quota: number
  role: Role
}

/**
 * Adhésion active de l'utilisateur : cookie `active_org` permet de basculer
 * de workspace s'il appartient à plusieurs organisations.
 */
export async function getMembership(user: { id: string; email: string }): Promise<{ organizationId: string; role: Role } | null> {
  const db = serviceDb()
  if (!db) return null
  const store = await cookies()
  const activeOrg = store.get('active_org')?.value

  // on renvoie les 2 premiers puis on choisit : simple et évite 2 requêtes conditionnelles
  const { data, error } = await db
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(2)
  type MemRow = { organization_id: string; role: string | null }
  const rows = ((data ?? []) as unknown) as MemRow[]
  if (error || !rows.length) return null
  if (activeOrg) {
    const hit = rows.find(m => m.organization_id === activeOrg)
    if (hit) return { organizationId: hit.organization_id, role: (hit.role as Role) ?? 'viewer' }
  }
  return { organizationId: rows[0].organization_id, role: (rows[0].role as Role) ?? 'viewer' }
}

export async function getOrgContext(): Promise<OrgCtx | null> {
  // rendu « à la demande » dès l'accès à la session : les internals auth
  // (calcul d'expiration de token) appellent Date.now(), interdit pendant le
  // prerender du shell statique (Next 16 cacheComponents).
  await connection()
  const user = await getAuthUser()
  if (!user) return null
  const db = serviceDb()
  if (!db) return null
  const membership = await getMembership(user)
  if (!membership || !membership.organizationId) return null

  const { data: org } = await db
    .from('organizations')
    .select('name, plan, contact_quota')
    .eq('id', membership.organizationId)
    .maybeSingle()
  if (!org) return null

  return {
    userId: user.id,
    email: user.email,
    orgId: membership.organizationId,
    orgName: String(org.name ?? ''),
    orgPlan: String(org.plan ?? 'free'),
    // Quota stocké s'il existe (grant admin, organisations historiques),
    // sinon celui du plan : plus de 5000 codé en dur hors du catalogue.
    quota: Number(org.contact_quota ?? quotaForPlan(String(org.plan ?? 'free'))),
    role: membership.role,
  }
}

/** Garde pour chaque page protégée : redirige vers /login ou /onboarding si absent. */
export async function requireOrg(): Promise<OrgCtx> {
  const ctx = await getOrgContext()
  if (!ctx) {
    const user = await getAuthUser()
    redirect(user ? '/onboarding' : '/login')
  }
  return ctx
}

export function canWrite(ctx: OrgCtx) {
  return ctx.role !== 'viewer'
}

export function canAdmin(ctx: OrgCtx) {
  return ctx.role === 'owner' || ctx.role === 'admin'
}

export function isOwner(ctx: OrgCtx) {
  return ctx.role === 'owner'
}
