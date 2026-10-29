import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { suggestFixForPhone, type CountryCode } from '@/lib/contacts/fix-country-code'
import { selectAllRows } from '@/lib/supabase/pagination'

export const instant = false

/**
 * Pays dominant de la base (numéros principaux valides) : sert d'indice de
 * réparation aux numéros locaux sans « + » (ex : fichiers Côte d'Ivoire).
 */
async function dominantIso2(orgId: string): Promise<string | null> {
  const db = serviceDb()
  if (!db) return null
  const rows = await selectAllRows<{ country_code: string | null }>((from, to) =>
    db.from('contact_phones').select('country_code')
      .eq('organization_id', orgId).eq('is_primary', true).eq('is_valid', true)
      .not('country_code', 'is', null)
      .order('id', { ascending: true }).range(from, to), 50000)
  const counts = new Map<string, number>()
  for (const r of rows) {
    const iso = String(r.country_code ?? '').toUpperCase()
    if (!iso) continue
    counts.set(iso, (counts.get(iso) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [iso, n] of counts) {
    if (n > bestN) { best = iso; bestN = n }
  }
  return best
}

export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  // numéros principaux invalides (limite raisonnable pour l'analyse)
  const { data, error } = await db.from('contact_phones')
    .select('id, contact_id, raw_phone, e164, is_valid')
    .eq('organization_id', ctx.orgId)
    .eq('is_primary', true)
    .eq('is_valid', false)
    .limit(5000)
  if (error) return NextResponse.json({ error: 'Analyse impossible.' }, { status: 500 })

  const rows = (data ?? []) as unknown as {
    id: string; contact_id: string; raw_phone: string | null; e164: string | null
  }[]

  const hint = (await dominantIso2(ctx.orgId)) as CountryCode | null
  const suggestions = []
  let unfixable = 0
  for (const r of rows) {
    const s = suggestFixForPhone({
      phoneId: r.id,
      contactId: r.contact_id,
      raw: r.raw_phone ?? '',
      e164: r.e164,
    }, hint)
    if (s) suggestions.push(s)
    else unfixable++
  }

  return NextResponse.json({
    suggestions,
    stats: {
      total: rows.length,
      fixable: suggestions.length,
      unfixable,
    },
  })
}
