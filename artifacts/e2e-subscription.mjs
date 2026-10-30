// E2E abonnement (sans Stripe) : parcours réel sur le serveur dev.
//  1. compte + workspace réels (register → onboarding)
//  2. attribution d'un plan mensuel par le super-admin (route réelle)
//  3. prolongation d'un plan actif : l'échéance s'empile
//  4. échéance forcée dans le passé : l'espace repasse en gratuit (bandeau + facturation)
//  5. renouvellement après expiration : la période repart de maintenant
//  6. arrêt (plan free) : échéance effacée
//  7. nettoyage complet : retour exact à l'état de base (organisations + comptes)
// Usage : node artifacts/e2e-subscription.mjs [baseURL]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3013'
const ADMIN_EMAIL = 'e2e-admin@contact-intel.test'
const PASSWORD = 'E2eAdmin2026!'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const jar = new Map()
async function call(path, { method = 'GET', body, raw } = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
  if (raw) return { status: res.status, text: await res.text() }
  return { status: res.status, json: await res.json().catch(() => null) }
}
const ok = (label, cond, detail = '') => console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)

/** Même règle que lib/billing/subscription.ts (addMonths, quantième conservé). */
function addMonths(date, months) {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}
const sameMinute = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 2 * 60_000

// ── état de base ────────────────────────────────────────────────────────────────
const { count: orgCountBefore } = await db.from('organizations').select('id', { count: 'exact', head: true })
console.log('Organisations avant test :', orgCountBefore)

// un compte admin e2e résiduel d'un run précédent ne doit pas gêner
for (const u of (await db.auth.admin.listUsers()).data?.users ?? []) {
  if (u.email === ADMIN_EMAIL) await db.auth.admin.deleteUser(u.id)
}

// ── 1. compte + workspace ──────────────────────────────────────────────────────
const reg = await call('/api/auth/register', { method: 'POST', body: { email: ADMIN_EMAIL, password: PASSWORD, fullName: 'E2E Admin' } })
ok('inscription', reg.status === 200, JSON.stringify(reg.json?.error ?? ''))
const login = await call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: PASSWORD } })
ok('connexion', login.status === 200, JSON.stringify(login.json?.error ?? ''))
const onboard = await call('/api/onboarding', { method: 'POST', body: { name: 'E2E Abonnement' } })
const orgId = onboard.json?.orgId
ok('workspace créé', onboard.status === 200 && !!orgId, JSON.stringify(onboard.json?.error ?? orgId))

const orgRow = async () => (await db.from('organizations')
  .select('plan, contact_quota, subscription_status, current_period_end').eq('id', orgId).maybeSingle()).data

// nouvelle organisation : gratuite, sans échéance
{
  const row = await orgRow()
  ok('départ en gratuit sans échéance', row?.plan === 'free' && !row?.current_period_end, JSON.stringify(row))
}

// ── 2. attribution mensuelle par l'admin ──────────────────────────────────────
const grant1 = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'business', months: 1 } })
ok('attribution business 1 mois', grant1.status === 200, `HTTP ${grant1.status} ${grant1.json?.error ?? ''}`)
const afterGrant = await orgRow()
ok('échéance = +1 mois', sameMinute(afterGrant?.current_period_end, addMonths(new Date(), 1)),
  `${afterGrant?.current_period_end} (attendu ~${addMonths(new Date(), 1).toISOString()})`)
ok('statut actif + quota business', afterGrant?.subscription_status === 'active' && afterGrant?.contact_quota === 50000,
  `status=${afterGrant?.subscription_status} quota=${afterGrant?.contact_quota}`)

const billing1 = await call('/settings/billing', { raw: true })
ok('page facturation : échéance affichée', billing1.status === 200 && /Accordé jusqu/.test(billing1.text) && /jours restants/.test(billing1.text))

// ── 3. prolongation d'un abonnement actif : empilement ────────────────────────
const grant2 = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'business', months: 3 } })
const afterExtend = await orgRow()
ok('prolongation 3 mois empilée', grant2.status === 200 && sameMinute(afterExtend?.current_period_end, addMonths(new Date(afterGrant.current_period_end), 3)),
  `${afterExtend?.current_period_end} (attendu ~${addMonths(new Date(afterGrant.current_period_end), 3).toISOString()})`)

// ── 4. expiration : échéance forcée hier ──────────────────────────────────────
await db.from('organizations').update({ current_period_end: new Date(Date.now() - 86_400_000).toISOString() }).eq('id', orgId)
const dash = await call('/dashboard', { raw: true })
ok('dashboard : bandeau d’expiration', dash.status === 200 && /Abonnement expiré le/.test(dash.text))
const billing2 = await call('/settings/billing', { raw: true })
ok('facturation : état expiré + plan gratuit', billing2.status === 200 && /Abonnement expiré le/.test(billing2.text) && /plan gratuit/.test(billing2.text))
const segments = await call('/segments', { raw: true })
ok('fonction payante reverrouillée', segments.status === 200 && /Débloquer|Débloquer avec|plan supérieur|starter/i.test(segments.text))

// ── 5. renouvellement après expiration : repart de maintenant ─────────────────
const renew = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'starter', months: 1 } })
const afterRenew = await orgRow()
ok('renouvellement après expiration', renew.status === 200 && sameMinute(afterRenew?.current_period_end, addMonths(new Date(), 1)),
  `${afterRenew?.current_period_end}`)
const dash2 = await call('/dashboard', { raw: true })
ok('bandeau disparu après renouvellement', !/Abonnement expiré le/.test(dash2.text))

// ── validations ───────────────────────────────────────────────────────────────
const badPlan = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'gold' } })
ok('plan inconnu refusé (400)', badPlan.status === 400, `HTTP ${badPlan.status}`)
const beforeZero = await orgRow()
const zeroMonths = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'starter', months: 0 } })
const afterZero = await orgRow()
// mois omis/0 → 1 mois, empilé sur l'échéance encore valide
ok('durée 0 → 1 mois par défaut', zeroMonths.status === 200 && sameMinute(afterZero?.current_period_end, addMonths(new Date(beforeZero.current_period_end), 1)),
  `${afterZero?.current_period_end}`)

// ── 6. arrêt : plan free, échéance effacée ───────────────────────────────────
const stop = await call(`/api/admin/orgs/${orgId}/plan`, { method: 'POST', body: { plan: 'free', months: 0 } })
const afterStop = await orgRow()
ok('arrêt : gratuit sans échéance', stop.status === 200 && afterStop?.plan === 'free' && afterStop?.current_period_end === null && afterStop?.subscription_status === 'none',
  JSON.stringify(afterStop))

// page d'administration : contrôles plan + durée rendus pour le super-admin
const adminPage = await call('/admin', { raw: true })
ok('page admin : contrôles de durée', adminPage.status === 200 && /Accordé jusqu/.test(adminPage.text) && /Prolonger|Accorder/.test(adminPage.text),
  `HTTP ${adminPage.status}`)

// journal : une ligne par action admin
const { count: logCount } = await db.from('plan_changes').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
ok('journal des changements alimenté', (logCount ?? 0) >= 5, `lignes=${logCount}`)

// ── 7. nettoyage complet ─────────────────────────────────────────────────────
for (const t of ['contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs', 'activity_logs', 'import_batches', 'export_runs', 'plan_changes', 'memberships']) {
  await db.from(t).delete().eq('organization_id', orgId)
}
await db.from('contacts').delete().eq('organization_id', orgId)
await db.from('organizations').delete().eq('id', orgId)
const users = (await db.auth.admin.listUsers()).data?.users ?? []
for (const u of users.filter(u => u.email === ADMIN_EMAIL)) await db.auth.admin.deleteUser(u.id)

const { count: orgCountAfter } = await db.from('organizations').select('id', { count: 'exact', head: true })
const { count: membersAfter } = await db.from('memberships').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
ok('organisation de test supprimée', orgCountAfter === orgCountBefore, `avant=${orgCountBefore} après=${orgCountAfter}`)
ok('aucune adhésion résiduelle', (membersAfter ?? 0) === 0)
ok('compte de test supprimé', !((await db.auth.admin.listUsers()).data?.users ?? []).some(u => u.email === ADMIN_EMAIL))
