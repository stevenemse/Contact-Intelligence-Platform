// Parcours complet de l'app sur le serveur de dev, avec compte et workspace réels.
// Chaque page est visitée, un import est réellement exécuté, puis les écrans
// (dashboard, contacts, doublons, segments, exports, carte, équipe...) sont
// confrontés à la base. Nettoyage complet à la fin.
// Usage : node artifacts/e2e-journey.mjs [baseURL]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3012'
const EMAIL = `e2e-journey-${Date.now().toString(36)}@contact-intel.test`
const PASSWORD = 'E2eJourney2026!'
const fails = []

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
  if (raw) return { status: res.status, text: await res.text(), type: res.headers.get('content-type') ?? '' }
  return { status: res.status, json: await res.json().catch(() => null) }
}
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fails.push(`${label}${detail ? ` (${detail})` : ''}`)
}
const n = (s) => Number(String(s).replace(/[^\d-]/g, ''))

const { count: orgCountBefore } = await db.from('organizations').select('id', { count: 'exact', head: true })

// ── compte + workspace ────────────────────────────────────────────────────────
await call('/api/auth/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD, fullName: 'Parcours E2E' } })
const login = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
ok('connexion', login.status === 200)
const onboard = await call('/api/onboarding', { method: 'POST', body: { name: 'Parcours E2E' } })
const orgId = onboard.json?.orgId
ok('workspace créé', Boolean(orgId))

// plan business actif 1 mois (équivalent d'une attribution admin) : débloque
// segments / carte / équipe / champs perso / activité
await db.from('organizations').update({
  plan: 'business', contact_quota: 50_000, subscription_status: 'active',
  current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
}).eq('id', orgId)

// ── import réel : 2 500 lignes, doublons lointains, numéros locaux, invalides ──
const rows = []
const tel = (i) => `+225 07 ${String(10 + (i % 80)).padStart(2, '0')} ${String(10 + (i % 70)).padStart(2, '0')} ${String(10 + (i % 60)).padStart(2, '0')} ${String(10 + (i % 50)).padStart(2, '0')}`
for (let i = 0; i < 1200; i++) {
  rows.push({
    full_name: `Contact ${i}`, phone: tel(i), email: `contact${i}@example.com`,
    company: i % 3 === 0 ? 'Alpha CI' : 'Beta Corp', source: 'Parcours',
    city: i % 2 === 0 ? 'Abidjan' : 'Bouaké', country: "Côte d'Ivoire",
  })
}
// doublon dans le premier lot
rows[4] = { ...rows[4], phone: rows[0].phone, email: 'doublon.proche@example.com' }
// doublon très éloigné (3e lot)
rows[1150] = { ...rows[1150], phone: rows[10].phone, email: 'doublon.lointain@example.com' }
// numéros locaux CI (réparation attendue) et numéros impossibles
for (let i = 50; i < 60; i++) rows[i] = { ...rows[i], phone: `07 ${String(10 + i)} ${String(20 + i)} ${String(30 + i)} ${String(40 + i)}` }
for (let i = 60; i < 65; i++) rows[i] = { ...rows[i], phone: 'abc' }
// emails invalides
for (let i = 70; i < 75; i++) rows[i] = { ...rows[i], email: 'pas-un-email' }

const mapping = { full_name: 'full_name', phone: 'phone', email: 'email', company: 'company', source: 'source', city: 'city', country: 'country' }
const create = await call('/api/imports', {
  method: 'POST',
  body: { action: 'create', fileName: 'parcours.csv', source: 'Parcours', mapping, dupRules: { keyPhone: true, keyEmail: true, onDuplicate: 'skip' }, totalRows: rows.length },
})
ok('import : création', create.status === 200 && create.json?.importId, `HTTP ${create.status} ${create.json?.error ?? ''}`)
const importId = create.json?.importId

const t0 = Date.now()
const report = { inserted: 0, skipped: 0, invalidPhone: 0, invalidEmail: 0, repaired: 0, errors: 0 }
let chunkFail = null
for (let offset = 0; offset < rows.length; offset += 1000) {
  const part = await call('/api/imports', { method: 'POST', body: { action: 'chunk', importId, offset, rows: rows.slice(offset, offset + 1000) } })
  if (part.status !== 200 || !part.json?.report) { chunkFail = `HTTP ${part.status} ${part.json?.error ?? ''}`; break }
  const r = part.json.report
  report.inserted += r.inserted; report.skipped += r.skipped
  report.invalidPhone += r.invalidPhone; report.invalidEmail += r.invalidEmail
  report.repaired += r.repaired ?? 0; report.errors += r.errors?.length ?? 0
}
const finish = await call('/api/imports', { method: 'POST', body: { action: 'finish', importId } })
console.log(`   rapport import : ${JSON.stringify(report)} en ${((Date.now() - t0) / 1000).toFixed(1)}s, statut=${finish.json?.status}`)
ok('import : aucun lot en erreur', chunkFail === null, chunkFail ?? '')
ok('import : doublon proche ET lointain ignorés', report.skipped >= 2, `skipped=${report.skipped}`)
ok('import : toutes les lignes comptabilisées', report.inserted + report.skipped === 1200, `insérés=${report.inserted} ignorés=${report.skipped}`)
ok('import : clôturé done', finish.json?.status === 'done', String(finish.json?.status))

// ── vérité base vs dashboard ─────────────────────────────────────────────────
async function dbCounts() {
  const { count: total } = await db.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).is('merged_into', null)
  const phones = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('contact_phones').select('contact_id, is_primary, is_valid, normalized_phone').eq('organization_id', orgId).order('id').range(from, from + 999)
    if (!data?.length) break
    phones.push(...data)
    if (data.length < 1000) break
  }
  const primary = new Map(phones.filter(p => p.is_primary).map(p => [p.contact_id, p]))
  let valid = 0, invalid = 0
  for (const p of primary.values()) {
    if (p.is_valid) valid++
    else invalid++
  }
  const byPhone = new Map()
  for (const p of primary.values()) {
    if (!p.normalized_phone) continue
    byPhone.set(p.normalized_phone, (byPhone.get(p.normalized_phone) ?? 0) + 1)
  }
  let dupes = 0
  for (const c of byPhone.values()) if (c > 1) dupes += c - 1
  return { total: total ?? 0, valid, invalid, dupes }
}
let truth = await dbCounts()

const dash = await call('/dashboard', { raw: true })
const kpis = [...dash.text.matchAll(/class="metric[^"]*"[^>]*>([^<]+)</g)].map(m => n(m[1]))
console.log(`   KPI dashboard : ${kpis.join(' | ')} — base : total=${truth.total} uniques=${truth.total - truth.dupes} doublons=${truth.dupes} valides=${truth.valid} invalides=${truth.invalid}`)
ok('dashboard : total exact', kpis[0] === truth.total, `${kpis[0]} vs ${truth.total}`)
ok('dashboard : uniques exact', kpis[1] === truth.total - truth.dupes, `${kpis[1]} vs ${truth.total - truth.dupes}`)
ok('dashboard : doublons exact', kpis[2] === truth.dupes, `${kpis[2]} vs ${truth.dupes}`)
ok('dashboard : numéros valides exact', kpis[3] === truth.valid, `${kpis[3]} vs ${truth.valid}`)
ok('dashboard : numéros invalides exact', kpis[4] === truth.invalid, `${kpis[4]} vs ${truth.invalid}`)
ok('dashboard : au moins un pays', (kpis[5] ?? 0) >= 1, String(kpis[5]))

// ── toutes les pages ────────────────────────────────────────────────────────
const pages = ['/dashboard', '/contacts', '/imports', '/imports/new', '/duplicates', '/segments', '/segments/new', '/map', '/exports', '/exports/new', '/tags', '/custom-fields', '/activity', '/team', '/settings', '/settings/billing', '/pricing', '/help']
for (const p of pages) {
  const r = await call(p, { raw: true })
  // « could not be found » est présent dans le payload RSC de Next (template 404) : ne pas le compter
  const broken = /Application error|Internal Server Error|Unhandled Runtime Error/i.test(r.text)
  ok(`page ${p}`, r.status === 200 && !broken, `HTTP ${r.status}${broken ? ' contenu en erreur' : ''}`)
}

// fiche contact
const { data: one } = await db.from('contacts').select('id, full_name').eq('organization_id', orgId).order('created_at').limit(1).maybeSingle()
const detail = await call(`/contacts/${one.id}`, { raw: true })
ok('fiche contact', detail.status === 200 && detail.text.includes(one.full_name ?? ''), `HTTP ${detail.status}`)

// recherche + filtres
const search = await call('/contacts?q=Contact%20123', { raw: true })
ok('recherche contact', search.status === 200 && search.text.includes('Contact 123'))
const invalidFilter = await call('/contacts?phoneValid=invalid', { raw: true })
ok('filtre numéros invalides', invalidFilter.status === 200 && invalidFilter.text.includes('abc'))

// ── réimport « importer quand même » → doublons fusionnables ─────────────────
const dupRows = rows.slice(0, 30).map(r => ({ ...r, email: `${Math.random().toString(36).slice(2)}@reimport.test` }))
const createD = await call('/api/imports', {
  method: 'POST',
  body: { action: 'create', fileName: 'reimport.csv', source: 'Reimport', mapping, dupRules: { keyPhone: true, keyEmail: false, onDuplicate: 'duplicate' }, totalRows: dupRows.length },
})
const importD = createD.json?.importId
let dupReport = null
if (importD) {
  const part = await call('/api/imports', { method: 'POST', body: { action: 'chunk', importId: importD, offset: 0, rows: dupRows } })
  dupReport = part.json?.report
  await call('/api/imports', { method: 'POST', body: { action: 'finish', importId: importD } })
}
ok('réimport : 30 fiches créées', dupReport?.inserted === 30, JSON.stringify(dupReport))
truth = await dbCounts()
ok('base : 30 doublons comptés', truth.dupes === 30, `dupes=${truth.dupes}`)

const dupPage = await call('/duplicates', { raw: true })
const groups = (dupPage.text.match(/Téléphone normalisé identique/g) ?? []).length
ok('page doublons : 30 groupes visibles', dupPage.status === 200 && groups === 30, `groupes=${groups}`)
const dashDup = [...(await call('/dashboard', { raw: true })).text.matchAll(/class="metric[^"]*"[^>]*>([^<]+)</g)].map(m => n(m[1]))
ok('dashboard : compteur doublons = page doublons', dashDup[2] === 30, `dashboard=${dashDup[2]}`)

// fusion d'un groupe
const { data: dupPhone } = await db.from('contact_phones')
  .select('normalized_phone').eq('organization_id', orgId).eq('is_primary', true)
  .not('normalized_phone', 'is', null).limit(500)
const counts = new Map()
for (const r of dupPhone ?? []) counts.set(r.normalized_phone, (counts.get(r.normalized_phone) ?? 0) + 1)
const target = [...counts.entries()].find(([, c]) => c > 1)
const { data: groupContacts } = await db.from('contact_phones').select('contact_id')
  .eq('organization_id', orgId).eq('normalized_phone', target[0]).eq('is_primary', true)
const merge = await call('/api/duplicates/merge', { method: 'POST', body: { keeperId: groupContacts[0].contact_id, mergedIds: [groupContacts[1].contact_id] } })
ok('fusion doublon', merge.status === 200, `HTTP ${merge.status} ${merge.json?.error ?? ''}`)
truth = await dbCounts()
ok('après fusion : 29 doublons, 1 contact absorbé', truth.dupes === 29 && truth.total === 1223, `total=${truth.total} dupes=${truth.dupes}`)

// ── segments ────────────────────────────────────────────────────────────────
const rules = [{ and: [{ field: 'country', op: 'eq', value: 'CI' }], or: [], not: [] }]
const segCreate = await call('/api/segments', { method: 'POST', body: { action: 'add', name: 'E2E Côte d’Ivoire', rules } })
ok('segment créé', segCreate.status === 200, `HTTP ${segCreate.status} ${segCreate.json?.error ?? ''}`)
const segCount = await call('/api/segments/count', { method: 'POST', body: { rules } })
ok('estimation segment', segCount.status === 200 && segCount.json?.count > 0, JSON.stringify(segCount.json))
const segPage = await call('/segments', { raw: true })
ok('page segments : segment listé', segPage.text.includes('E2E Côte'))

// ── exports ─────────────────────────────────────────────────────────────────
const exp = await call('/api/exports/run', {
  method: 'POST',
  body: { scope: 'all', onlyUnique: true, columns: ['full_name', 'phone', 'email', 'country'] },
})
const csv = exp.json?.files?.[0]?.content ?? ''
ok('export base entière', exp.status === 200 && /Nom complet/.test(csv) && csv.split('\n').length > 1000,
  `HTTP ${exp.status} totalRows=${exp.json?.totalRows} lignes=${csv.split('\n').length}`)
const expPage = await call('/exports', { raw: true })
ok('page exports : run listé', expPage.status === 200 && /base entière|Base entière/i.test(expPage.text), `HTTP ${expPage.status}`)

// ── tags / champs perso / équipe / paramètres ───────────────────────────────
const tagAdd = await call('/api/tags', { method: 'POST', body: { action: 'add', name: 'e2e-tag', color: '#0d9488' } })
ok('tag créé', tagAdd.status === 200, JSON.stringify(tagAdd.json))
ok('page tags : tag visible', (await call('/tags', { raw: true })).text.includes('e2e-tag'))

const cfAdd = await call('/api/custom-fields', { method: 'POST', body: { action: 'add', label: 'Secteur E2E', type: 'text' } })
ok('champ personnalisé créé', cfAdd.status === 200, JSON.stringify(cfAdd.json))
ok('page champs : visible', (await call('/custom-fields', { raw: true })).text.includes('Secteur E2E'))

const invite = await call('/api/team/invite', { method: 'POST', body: { email: 'collegue.e2e@contact-intel.test', role: 'member' } })
ok('invitation équipe', invite.status === 200, JSON.stringify(invite.json))
ok('page équipe : invitation visible', (await call('/team', { raw: true })).text.includes('collegue.e2e@contact-intel.test'))

const rename = await call('/api/settings/org', { method: 'POST', body: { name: 'Parcours Renommé' } })
ok('renommage espace', rename.status === 200, JSON.stringify(rename.json))
ok('paramètres : nouveau nom affiché', (await call('/settings', { raw: true })).text.includes('Parcours Renommé'))

// ── réparation des numéros invalides ────────────────────────────────────────
const suggest = await call('/api/phone-fix/suggest')
const sug = suggest.json
console.log('   suggestions de réparation :', JSON.stringify(sug).slice(0, 200))
ok('suggestions de réparation renvoyées', suggest.status === 200 && Array.isArray(sug?.suggestions), `HTTP ${suggest.status}`)
if (sug?.suggestions?.length) {
  const apply = await call('/api/phone-fix/apply', { method: 'POST', body: { fixes: sug.suggestions.slice(0, 5).map(s => ({ phoneId: s.phoneId ?? s.id, e164: s.e164 ?? s.suggested })) } })
  ok('application des corrections', apply.status === 200 && (apply.json?.applied ?? 0) > 0, JSON.stringify(apply.json).slice(0, 160))
}

// ── carte + activité ────────────────────────────────────────────────────────
const mapPage = await call('/map', { raw: true })
ok('carte : pays affichés', mapPage.status === 200 && /Côte d.Ivoire|Ivory Coast/.test(mapPage.text))
const actPage = await call('/activity', { raw: true })
ok('activité : entrées présentes', actPage.status === 200 && /import|Import|invit/i.test(actPage.text))

// ── nettoyage ───────────────────────────────────────────────────────────────
for (const t of ['contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs', 'activity_logs', 'import_batches', 'export_runs', 'plan_changes', 'segments', 'tags', 'custom_fields', 'org_invites', 'memberships']) {
  await db.from(t).delete().eq('organization_id', orgId)
}
// contacts.merged_into est une FK vers contacts : la remettre à NULL évite que
// le delete échoue en boucle (et gèle le nettoyage).
await db.from('contacts').update({ merged_into: null }).eq('organization_id', orgId)
for (let pass = 0; pass < 40; pass++) {
  const { data: ids } = await db.from('contacts').select('id').eq('organization_id', orgId).limit(500)
  if (!ids?.length) break
  const { error } = await db.from('contacts').delete().in('id', ids.map(r => r.id))
  if (error) { console.log('  ⚠ nettoyage contacts :', error.message); break }
}
await db.from('organizations').delete().eq('id', orgId)
for (const u of (await db.auth.admin.listUsers()).data?.users ?? []) {
  if (u.email === EMAIL) await db.auth.admin.deleteUser(u.id)
}
const { count: orgCountAfter } = await db.from('organizations').select('id', { count: 'exact', head: true })
ok('nettoyage : base revenue à l’état initial', orgCountAfter === orgCountBefore, `avant=${orgCountBefore} après=${orgCountAfter}`)

console.log(fails.length === 0 ? '\n✅ Parcours complet sans échec' : `\n❌ ${fails.length} échec(s) :\n - ${fails.join('\n - ')}`)
process.exitCode = fails.length === 0 ? 0 : 1
