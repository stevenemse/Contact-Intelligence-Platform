// Org de test en Enterprise palier 100k : vérifie l'affichage de la jauge et l'affinement.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
for (const line of readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const BASE = 'http://localhost:3012'
const EMAIL = `ent-${Date.now().toString(36)}@contact-intel.test`
const PASSWORD = 'EntTest2026!'
const jar = new Map()
async function call(path, { method='GET', body } = {}) {
  const cookie = [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')
  const res = await fetch(BASE+path, { method, headers: { 'Content-Type':'application/json', ...(cookie?{Cookie:cookie}:{}) }, body: body?JSON.stringify(body):undefined })
  for (const c of res.headers.getSetCookie?.() ?? []) { const [p]=c.split(';'); const i=p.indexOf('='); jar.set(p.slice(0,i), p.slice(i+1)) }
  return { status: res.status, json: await res.json().catch(()=>null) }
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
await call('/api/auth/register', { method:'POST', body:{ email: EMAIL, password: PASSWORD, fullName: 'Ent Test' } })
await call('/api/auth/login', { method:'POST', body:{ email: EMAIL, password: PASSWORD } })
const onboard = await call('/api/onboarding', { method:'POST', body:{ name: 'Ent Test' } })
const orgId = onboard.json?.orgId
// écrit exactement ce que l'API admin écrit pour enterprise palier 100k
await db.from('organizations').update({ plan:'enterprise', contact_quota:100_000, subscription_status:'active', current_period_end:new Date(Date.now()+30*86400000).toISOString() }).eq('id', orgId)
const { data: org } = await db.from('organizations').select('plan, contact_quota').eq('id', orgId).maybeSingle()
console.log('CREDS', JSON.stringify({ EMAIL, PASSWORD, orgId }), 'org=', JSON.stringify(org))
