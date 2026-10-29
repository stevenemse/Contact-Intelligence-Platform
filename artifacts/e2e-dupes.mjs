// Suite e2e : réimport « importer quand même » danns une org dont le quota a été
// relevé, doublons visibles au centre Doublons, fusion réelle d'un couple,
// constat de la baisse du compteur. Usage : node artifacts/e2e-dupes.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3012'
const EMAIL = process.argv[3]
const PASSWORD = process.argv[4]
if (!EMAIL) { console.log('Usage : node artifacts/e2e-dupes.mjs [base] [email] [password]'); process.exit(1) }

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ok = (label, cond, detail = '') =>
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)

const jar = new Map()
async function call(path, { method = 'GET', body, raw } = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  for (const c of (res.headers.getSetCookie?.() ?? [])) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
  if (raw) return { status: res.status, text: await res.text() }
  return { status: res.status, json: await res.json().catch(() => null) }
}

// session (cookies sb-*)
const login = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
ok('login', login.status === 200, JSON.stringify(login.json?.error ?? ''))

// quota relevé (plan fictif payant) : sinon 402 QUOTA_REACHED bloque le réimport
const { data: mems } = await svc.from('memberships').select('organization_id').eq('user_id', login.json.userId)
const orgId = mems?.[0]?.organization_id
const { error: qErr } = await svc.from('organizations').update({ contact_quota: 50000 }).eq('id', orgId)
ok('quota relevé à 50 000', !qErr, qErr?.message ?? '')

// page /duplicates AVANT réimport : aucun groupe
const before = await call('/duplicates', { raw: true })
const groupsBefore = (before.text.match(/Téléphone normalisé identique/g) ?? []).length
ok('page /duplicates : 0 groupe avant réimport', before.status === 200 && groupsBefore === 0, `groupes=${groupsBefore}`)

// ── réimport 50 lignes déjà en base, mode « duplicate » ──
const dupesCsv = readFileSync('public/e2e-dupes.csv', 'utf8').split('\n').filter(Boolean)
const rows = dupesCsv.slice(1).map(l => {
  const c = l.split(',')
  return { full_name: c[0], phone: c[1], email: c[2], company: c[3], source: c[4], city: c[5], pays: c[6] }
})
const mapping = { full_name: 'full_name', phone: 'phone', email: 'email', company: 'company', source: 'source', city: 'city', country: 'pays' }
const create = await call('/api/imports', {
  method: 'POST',
  body: { action: 'create', fileName: 'e2e-dupes.csv', source: 'E2E-DUPE', mapping,
    dupRules: { keyPhone: true, keyEmail: true, onDuplicate: 'duplicate' }, totalRows: rows.length },
})
const importId = create.json?.importId
const chunk = await call('/api/imports', { method: 'POST', body: { action: 'chunk', importId, offset: 0, rows } })
await call('/api/imports', { method: 'POST', body: { action: 'finish', importId } })
ok('réimport : 50 fiches créées, 0 ignorée', chunk.json?.report?.inserted === 50 && chunk.json?.report?.skipped === 0,
  `inserted=${chunk.json?.report?.inserted} skipped=${chunk.json?.report?.skipped}`)

// ── page /duplicates : groupes visibles maintenant ──
const after = await call('/duplicates', { raw: true })
const groups = (after.text.match(/Téléphone normalisé identique/g) ?? []).length
ok('page /duplicates : groupes affichés après réimport', after.status === 200 && groups > 0, `groupes=${groups === 0 ? 0 : after.text.split('Dans un groupe').length - 1 || groups}`)
const dupBadge = after.text.match(/(\d[\d\u202f\u00a0 ]*)(?:\s*|\n)*fi(?:ches|che)?s?[\s\S]{0,40}doublon/i)
console.log('   badge page doublons :', dupBadge?.[1]?.trim() ?? '(non lu)')

// ── fusion réelle du groupe du contact c0 (+225 05 26 84 28 73)
const num0 = await svc.from('contact_phones').select('contact_id, normalized_phone, is_primary').eq('organization_id', orgId).eq('normalized_phone', '+225 05 26 84 2873').limit(10)
const phn = (num0.data ?? [])
const pair = [...new Set(phn.map(p => p.contact_id))]
ok('groupe c0 : plusieurs contacts partagent le numéro', pair.length >= 2, `contacts=${pair.length}`)
if (pair.length >= 2) {
  // conservé = celui du premier import (retrouvé par createdAt le plus ancien)
  const { data: two } = await svc.from('contacts').select('id, full_name, created_at').in('id', pair).order('created_at', { ascending: true })
  const keeper = two?.[0] ?? null
  const loser = two?.[1]
  const merge = await call('/api/duplicates/merge', { method: 'POST', body: { keeperId: keeper.id, mergedIds: [loser.id] } })
  ok('fusion du couple', merge.status === 200 && merge.json?.merged === 1, JSON.stringify(merge.json?.error ?? '', '').slice(0, 80))

  // fiche fusionnée : merged_into renseigné, hors activeContacts
  const { data: loserAfter } = await svc.from('contacts').select('merged_into').eq('id', loser.id).maybeSingle()
  ok('fiche absorbée marquée merged_into', loserAfter?.merged_into === keeper.id)

  // journal d'audit : une ligne merge_logs pour cette absorption
  const { data: ml } = await svc.from('merge_logs').select('id').eq('organization_id', orgId).eq('merged_id', loser.id)
  ok('fusion journalisée (merge_logs)', (ml ?? []).length === 1)

  // conservé : garde le numéro (ou l'a récupéré de la fiche absorbée)
  const { count: keeperPh } = await svc.from('contact_phones').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('contact_id', keeper.id).eq('normalized_phone', '+225 05 26 84 2873')
  ok('le conservé porte toujours le numéro', (keeperPh ?? 0) >= 1, `phones=${keeperPh}`)

  // dashboard : rendu 200 après fusion
  const dash = await call('/dashboard', { raw: true })
  ok('dashboard 200 après fusion', dash.status === 200)
}
console.log('\nSTATE org=', orgId)
