// E2E : parcours réel d'import d'un gros CSV via l'app (HTTP sur le serveur dev).
//  1. inscription email/mot de passe via /api/auth/register (route réelle)
//  2. création du workspace via /api/onboarding (route réelle)
//  3. import 18 000 lignes : create → chunks de 1 000 → finish (dupRules skip)
//  4. réimport e2e-dupes.csv (50 lignes déjà en base) avec onDuplicate='duplicate'
//  5. contrôle : compteur dashboard d'écrans publics + page /duplicates
// Usage : node artifacts/e2e-run.mjs [baseURL]
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3012'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const EMAIL = `e2e-${Date.now().toString(36)}@contact-intel.test`
const PASSWORD = 'E2eTest2026!'

const jar = new Map()
async function call(path, { method = 'GET', body, raw } = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
  if (raw) return { status: res.status, text: await res.text() }
  return { status: res.status, json: await res.json().catch(() => null) }
}

const ok = (label, cond, detail = '') =>
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)

// 1. inscription
await call('/api/auth/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD, fullName: 'E2E Buffy' } })
  .then(r => ok('register', r.status === 200, JSON.stringify(r.json?.error ?? r.json)))
// login (le register signe déjà la session côté client SSR ; ici on s'assure des cookies sb-*)
const login = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
ok('login', login.status === 200, JSON.stringify(login.json?.error ?? ''))

// 2. workspace
const onboard = await call('/api/onboarding', { method: 'POST', body: { name: 'E2E Côte Test' } })
ok('onboarding', onboard.status === 200 && onboard.json?.orgId, JSON.stringify(onboard.json?.error ?? onboard.json?.orgId))

// 3. import 18 000 lignes
const csv = readFileSync('public/e2e-import.csv', 'utf8').split('\n').filter(Boolean)
const rows = csv.slice(1).map(l => {
  const cells = l.split(',')
  return {
    full_name: cells[0], phone: cells[1], email: cells[2], company: cells[3],
    source: cells[4], city: cells[5], pays: cells[6],
  }
})
const mapping = {
  full_name: 'full_name', phone: 'phone', email: 'email', company: 'company',
  source: 'source', city: 'city', country: 'pays',
}
const mappingSend = mapping
const CREATE_ROWS = 1000
const t0 = Date.now()
const create = await call('/api/imports', {
  method: 'POST',
  body: {
    action: 'create', fileName: 'e2e-import.csv', source: 'E2E', mapping: mappingSend,
    dupRules: { keyPhone: true, keyEmail: true, onDuplicate: 'skip' }, totalRows: rows.length,
  },
})
ok('create', create.status === 200 && create.json?.importId, `HTTP ${create.status} ${create.json?.error ?? ''}`)
const importId = create.json?.importId

const merged = { inserted: 0, updated: 0, skipped: 0, invalidPhone: 0, invalidEmail: 0, repaired: 0, errors: [] }
let chunkFail = null
for (let offset = 0; offset < rows.length; offset += CREATE_ROWS) {
  const slice = rows.slice(offset, offset + CREATE_ROWS)
  const part = await call('/api/imports', { method: 'POST', body: { action: 'chunk', importId, offset, rows: slice } })
  if (part.status !== 200 || !part.json?.report) { chunkFail = `HTTP ${part.status} ${part.json?.error ?? ''}`; break }
  const r = part.json.report
  merged.inserted += r.inserted; merged.skipped += r.skipped; merged.updated += r.updated
  merged.invalidPhone += r.invalidPhone; merged.invalidEmail += r.invalidEmail
  merged.repaired += r.repaired ?? 0
  merged.errors.push(...(r.errors ?? []))
}
const finish = await call('/api/imports', { method: 'POST', body: { action: 'finish', importId } })
const dt = ((Date.now() - t0) / 1000).toFixed(1)
ok('import 18k terminé sans lot en erreur', chunkFail === null, chunkFail ?? '')
console.log(`   rapport: insérés=${merged.inserted.toLocaleString('fr-FR')} doublons=${merged.skipped} réparés=${merged.repaired} invalides tel/email=${merged.invalidPhone}/${merged.invalidEmail} erreurs=${merged.errors.length} (${dt}s, statut=${finish.json?.status})`)

// attentes : presque tout inséré, les 2 doublons lointains (lignes 12 002 / 14 502) + petites
// collisions de re-génération détectés, aucun numéro resté invalide
ok('≥ 17 790 contacts insérés', merged.inserted >= 17790, `inserted=${merged.inserted}`)
ok('doublons lointains détectés (skipped ≥ 2)', merged.skipped >= 2, `skipped=${merged.skipped}`)
ok('téléphones réparés comptés', merged.repaired >= 1500, `repaired=${merged.repaired}`)
ok('aucun numéro resté invalide', merged.invalidPhone === 0, `invalidPhone=${merged.invalidPhone}`)
ok('aucune erreur de ligne', merged.errors.length === 0, `errors=${merged.errors.length}`)

// 4. réimport « importer quand même » : 50 lignes déjà en base
const dupesCsv = readFileSync('public/e2e-dupes.csv', 'utf8').split('\n').filter(Boolean)
const dupesRows = dupesCsv.slice(1).map(l => {
  const cells = l.split(',')
  return { full_name: cells[0], phone: cells[1], email: cells[2], company: cells[3], source: cells[4], city: cells[5], pays: cells[6] }
})
const createD = await call('/api/imports', {
  method: 'POST',
  body: {
    action: 'create', fileName: 'e2e-dupes.csv', source: 'E2E-DUPE', mapping: mappingSend,
    dupRules: { keyPhone: true, keyEmail: true, onDuplicate: 'duplicate' }, totalRows: dupesRows.length,
  },
})
ok('create (réimport)', createD.status === 200, `HTTP ${createD.status} ${createD.json?.error ?? ''}`)
const importIdD = createD.json?.importId

let dupReport = null
const part = await call('/api/imports', { method: 'POST', body: { action: 'chunk', importId: importIdD, offset: 0, rows: dupesRows } })
if (part.status === 200) dupReport = part.json.report
await call('/api/imports', { method: 'POST', body: { action: 'finish', importId: importIdD } })
ok('réimport « importer quand même » : 50 lignes créées', dupReport?.inserted === 50, `inserted=${dupReport?.inserted} skipped=${dupReport?.skipped}`)

// 5. page /duplicates du rendu serveur : numéros partagés attendus en double
const dupPage = await call('/duplicates', { raw: true })
const groups = (dupPage.text.match(/Téléphone normalisé identique/g) ?? []).length
ok('page /duplicates : groupes visibles', dupPage.status === 200 && groups > 0, `HTTP ${dupPage.status}, groupes=${groups}`)
console.log('   e2e user :', EMAIL)

// état final pour le script de contrôle : coordonnées du compte
console.log(`\nSTATE email=${EMAIL} password=${PASSWORD}`)
