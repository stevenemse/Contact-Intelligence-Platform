import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
for (const line of readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: orgs } = await db.from('organizations').select('id, name, plan, subscription_status, current_period_end, created_at').order('created_at')
for (const o of orgs ?? []) {
  const { count: contacts } = await db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id', o.id)
  const { count: members } = await db.from('memberships').select('id',{count:'exact',head:true}).eq('organization_id', o.id)
  console.log(`${o.id} | ${o.name} | ${o.plan} | ${o.subscription_status} | contacts=${contacts} members=${members}`)
}
const { data: users } = await db.auth.admin.listUsers()
console.log('--- users ---')
for (const u of users.users) console.log(u.email, u.created_at)
const { count: allContacts } = await db.from('contacts').select('id',{count:'exact',head:true})
console.log('total contacts toutes orgs:', allContacts)
