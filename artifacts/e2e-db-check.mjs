import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })

const EMAIL = 'e2e-buffy@contact-intel.test'

const { data: users } = await db.auth.admin.listUsers()
const user = users.users.find(u => u.email === EMAIL)
if (!user) { console.log('USER_NOT_FOUND'); process.exit(0) }
console.log('user:', user.id)

const { data: mems } = await db.from('memberships').select('organization_id, role').eq('user_id', user.id)
console.log('memberships:', JSON.stringify(mems))
const orgId = mems?.[0]?.organization_id
if (!orgId) process.exit(0)

for (const t of ['contacts', 'contact_phones', 'contact_emails', 'import_batches']) {
  const { count } = await db.from(t).select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  console.log(t, '=', count)
}

const { data: batches } = await db.from('import_batches').select('file_name,status,total_rows,new_contacts,duplicates_skipped,invalid_phones,invalid_emails,errors_count').eq('organization_id', orgId)
console.log('batches:', JSON.stringify(batches))

// échantillon :groupe des numéros les plus partagés
const { data: c } = await db.from('contacts').select('id, full_name, country_iso2').eq('organization_id', orgId).order('created_at').limit(3)
console.log('contacts sample:', JSON.stringify(c))
const { data: p } = await db.from('contact_phones').select('raw_phone, normalized_phone, is_valid, is_primary, country_code').eq('organization_id', orgId).order('created_at').limit(8)
console.log('phones sample:', JSON.stringify(p, null, 1))

// groupes de numéros partagés par 2+ contacts actifs
const { data: ph } = await db.from('contact_phones').select('normalized_phone, contact_id, is_primary').eq('organization_id', orgId).not('normalized_phone', 'is', null).range(0, 29999)
const map = new Map()
for (const r of ph) {
  const iso = String(r.normalized_phone)
  const cur = map.get(iso) ?? { n: 0, primaries: 0 }
  cur.n++
  if (r.is_primary) cur.primaries++
  map.set(iso, cur)
}
let dupGroups = 0
let inDup = []
for (const [iso, v] of map) {
  if (v.primaries > 1) { dupGroups++; if (inDup.length < 8) inDup.push(iso) }
}
console.log('dup groups (2+ primaries):', dupGroups, '— ex:', inDup)
process.exit(0)
