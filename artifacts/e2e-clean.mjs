// Nettoyage e2e : supprime les données des comptes test (email @contact-intel.test)
// puis les comptes auth eux-mêmes. Usage : node artifacts/e2e-clean.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: users } = await db.auth.admin.listUsers()
const testUsers = users.users.filter(u => /@contact-intel\.test$/.test(u.email))
console.log('Comptes test trouvés :', testUsers.map(u => u.email).join(', ') || 'aucun')

const ORG_TABLES = [
  'contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs',
  'import_batches', 'export_runs', 'activity_logs', 'memberships', 'organizations',
]

/**
 * Purge sévère : supprime toute la donnée d'une organisation par sous-entités
 * puis les contacts par lots (le delete massif peut dépasser le timeout PG).
 */
async function wipeOrg(orgId) {
  for (const t of ['contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs', 'activity_logs', 'import_batches', 'export_runs']) {
    await db.from(t).delete().eq('organization_id', orgId)
  }
  while (true) {
    const { data: ids } = await db.from('contacts').select('id').eq('organization_id', orgId).limit(5000)
    if (!ids?.length) break
    await db.from('contacts').delete().in('id', ids.map(r => r.id))
  }
  const { count } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  console.log('  contacts restants avant suppression org :', count ?? '?')
  await db.from('organizations').delete().eq('id', orgId)
}

let cleaned = 0
for (const u of testUsers) {
  const { data: mems } = await db.from('memberships').select('organization_id').eq('user_id', u.id)
  for (const m of mems ?? []) {
    await wipeOrg(m.organization_id)
    // le membership lui-même
    await db.from('memberships').delete().eq('organization_id', m.organization_id)
    cleaned++
  }
  const { error } = await db.auth.admin.deleteUser(u.id)
  console.log(error ? `  ⚠ suppression compte ${u.email} : ${error.message}` : `  🗑 compte + données supprimés : ${u.email}`)
}
console.log('Organisations nettoyées :', cleaned)
