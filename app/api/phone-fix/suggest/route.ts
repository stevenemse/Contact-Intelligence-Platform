import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { suggestFixForPhone } from '@/lib/contacts/fix-country-code'

export const instant = false

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

  const suggestions = []
  let unfixable = 0
  for (const r of rows) {
    const s = suggestFixForPhone({
      phoneId: r.id,
      contactId: r.contact_id,
      raw: r.raw_phone ?? '',
      e164: r.e164,
    })
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
