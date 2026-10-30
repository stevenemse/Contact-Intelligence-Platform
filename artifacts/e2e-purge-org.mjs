// Purge d'UNE organisation de test, par identifiant exact (jamais par nom seul).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const id = process.argv[2]
if (!/^[0-9a-f-]{36}$/.test(id ?? '')) { console.error('identifiant d’organisation requis'); process.exit(2) }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: org } = await db.from('organizations').select('id,name').eq('id', id).maybeSingle()
if (!org) { console.log('organisation absente'); process.exit(0) }
console.log('purge de', org.name, org.id)
for (const t of ['contact_emails','contact_phones','contact_tags','contact_changes','merge_logs','activity_logs','import_batches','export_runs','plan_changes','segments','tags','custom_fields','org_invites','memberships']) {
  await db.from(t).delete().eq('organization_id', id)
}
await db.from('contacts').update({ merged_into: null }).eq('organization_id', id).not('merged_into', 'is', null)
let guard = 0
while (guard++ < 100) {
  const { data: ids } = await db.from('contacts').select('id').eq('organization_id', id).limit(200)
  if (!ids?.length) break
  await db.from('contacts').delete().in('id', ids.map(r => r.id))
}
await db.from('organizations').delete().eq('id', id)
console.log('terminé')
