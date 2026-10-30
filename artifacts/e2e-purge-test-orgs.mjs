// Purge STRICTEMENT scalpel : supprime uniquement l'org de test explicite
// (identifier "Navigation Test", compte nav-mvucornb@contact-intel.test).
// Toute autre org est ignorée, même si l'utilisateur est un compte test.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TEST_ORG_ID = '6942fd75-54f4-43ec-a58c-3b63bc9a2afe'
const TEST_EMAIL = 'ent-mvvm1fus@contact-intel.test'

const { data: org, error: orgErr } = await db.from('organizations').select('id, name').eq('id', TEST_ORG_ID).maybeSingle()
if (orgErr || !org) { console.log('Org de test introuvable, rien à faire.', orgErr?.message ?? ''); process.exit(0) }
console.log('Org ciblée :', org.id, '|', org.name)

for (const t of ['contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs', 'activity_logs', 'import_batches', 'export_runs']) {
  await db.from(t).delete().eq('organization_id', org.id)
}
while (true) {
  const { data: ids } = await db.from('contacts').select('id').eq('organization_id', org.id).limit(2000)
  if (!ids?.length) break
  await db.from('contacts').delete().in('id', ids.map(r => r.id))
}
const { error: memErr } = await db.from('memberships').delete().eq('organization_id', org.id)
console.log('  memberships supprimés :', memErr ? memErr.message : 'ok')
const { error: orgDelErr } = await db.from('organizations').delete().eq('id', org.id)
console.log('  organisation supprimée :', orgDelErr ? orgDelErr.message : 'ok')

const { data: users } = await db.auth.admin.listUsers()
for (const u of users.users) {
  if (u.email !== TEST_EMAIL) continue
  const { error } = await db.auth.admin.deleteUser(u.id)
  console.log(error ? `  ⚠ suppression compte ${u.email} : ${error.message}` : `  🗑 compte auth supprimé : ${u.email}`)
}
console.log('Purge org de test terminée.')
