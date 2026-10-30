// Purge robuste des organisations orphelines. Sous-entités par
// eq(organization_id) (marche dans lesLIMITES PG), contacts par lots de 200.
// Boucle jusqu'à zéro. Usage : node artifacts/e2e-purge.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const SENTINEL = 'artifacts/.purge-done'
try { unlinkSync(SENTINEL) } catch {}

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SUB = ['contact_emails', 'contact_phones', 'contact_tags', 'contact_changes', 'merge_logs', 'activity_logs', 'import_batches', 'export_runs']
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function countOrg(t, orgId) {
  const { count } = await db.from(t).select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
  return count ?? 0
}

while (true) {
  const { data: allOrgs } = await db.from('organizations').select('id, name')
  const { data: mems } = await db.from('memberships').select('organization_id')
  const withMem = new Set((mems ?? []).map(m => m.organization_id))
  const orphans = (allOrgs ?? []).filter(o => !withMem.has(o.id))
  if (!orphans.length) { console.log('AUCUNE orpheline'); break }

  for (const o of orphans) {
    console.log('purge', o.name)
    // 1. sous-entités : delete par organization_id, répété si timeout
    for (const t of SUB) {
      for (let k = 0; k < 10; k++) {
        const n = await countOrg(t, o.id)
        if (n === 0) break
        const { error } = await db.from(t).delete().eq('organization_id', o.id)
        if (error) { console.log('  ⚠', t, error.message); await sleep(500) }
      }
      const n = await countOrg(t, o.id)
      if (n > 0) console.log('  !', t, 'non purgé :', n)
    }

    // 2. contacts : on ne peut pas tout supprimer d'une traite (timeout PG) ;
    // on les enlève par lots de 200 sélectionnés dans l'ordre du PK.
    for (let guard = 0; guard < 200; guard++) {
      const { data, error } = await db.from('contacts').select('id').eq('organization_id', o.id).order('id', { ascending: true }).limit(200)
      if (error) { console.log('  ⚠ contacts select:', error.message); break }
      if (!data?.length) break
      const { error: err } = await db.from('contacts').delete().in('id', data.map(r => r.id))
      if (err) { console.log('  ⚠ contacts delete:', err.message); await sleep(400) }
    }
    const restants = await countOrg('contacts', o.id)
    console.log('  contacts restants :', restants)
    if (restants > 0) { console.log('  ⚠ org nounournée, on renouvelle le tour'); continue }

    // 3. org elle-même
    const { error } = await db.from('organizations').delete().eq('id', o.id)
    console.log('  org supprimée :', error?.message ?? 'OK')
  }
}

const { data: left } = await db.from('organizations').select('name')
console.log('organizations restantes :', (left ?? []).map(o => o.name))
writeFileSync(SENTINEL, 'done\n')
console.log('DONE')
