import { NextResponse, type NextRequest } from 'next/server'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const addSchema = z.object({ action: z.literal('add'), phone: z.string().min(1).max(40) })
const delSchema = z.object({ action: z.literal('delete'), phoneId: z.string().uuid() })
const primarySchema = z.object({ action: z.literal('primary'), phoneId: z.string().uuid() })
const bodySchema = z.union([addSchema, delSchema, primarySchema])

function normalize(raw: string): { normalized: string | null; e164: string | null; cc: string | null; valid: boolean } | null {
  const parsed = parsePhoneNumberFromString(raw)
  if (!parsed) return null
  return {
    normalized: parsed.formatInternational(),
    e164: parsed.format('E.164'),
    cc: parsed.country ?? null,
    valid: parsed.isValid(),
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  if (!serviceDb()) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  const { id } = await params
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const db = serviceDb()!
  const owner = { organization_id: ctx.orgId }

  // contact existe ?
  const { data: contact } = await db.from('contacts').select('id').eq('organization_id', ctx.orgId).eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  if (body.action === 'add') {
    const { count } = await db.from('contact_phones').select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId).eq('contact_id', id)
    const norm = normalize(body.phone)
    const { error } = await db.from('contact_phones').insert({
      ...owner,
      contact_id: id,
      raw_phone: body.phone,
      normalized_phone: norm?.normalized ?? null,
      e164: norm?.e164 ?? null,
      country_code: norm?.cc ?? null,
      is_valid: norm?.valid ?? false,
      is_primary: (count ?? 0) === 0,
    })
    if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'contact.phone_added', 'contact', id, { phone: body.phone })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'delete') {
    const { data: ph } = await db.from('contact_phones').select('id, is_primary')
      .eq('organization_id', ctx.orgId).eq('id', body.phoneId).eq('contact_id', id).maybeSingle()
    if (!ph) return NextResponse.json({ error: 'Téléphone introuvable' }, { status: 404 })
    const { error } = await db.from('contact_phones').delete()
        .eq('organization_id', ctx.orgId).eq('contact_id', id).eq('id', body.phoneId)

    if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })
    // si c'était le principal, promouvoir le premier restant
    if (ph.is_primary) {
      const { data: next } = await db.from('contact_phones').select('id')
        .eq('organization_id', ctx.orgId).eq('contact_id', id).limit(1).maybeSingle()
      if (next) await db.from('contact_phones').update({ is_primary: true })
        .eq('organization_id', ctx.orgId).eq('contact_id', id).eq('id', next.id)
    }
    await logActivity(ctx.orgId, ctx.userId, 'contact.phone_removed', 'contact', id, {})
    return NextResponse.json({ ok: true })
  }

  // primary : vérifier la cible avant de modifier l'état du contact
  const { data: targetPhone } = await db.from('contact_phones').select('id')
    .eq('organization_id', ctx.orgId).eq('contact_id', id).eq('id', body.phoneId).maybeSingle()
  if (!targetPhone) return NextResponse.json({ error: 'Téléphone introuvable' }, { status: 404 })
  await db.from('contact_phones').update({ is_primary: false })
    .eq('organization_id', ctx.orgId).eq('contact_id', id)
  const { error } = await db.from('contact_phones').update({ is_primary: true })
    .eq('organization_id', ctx.orgId).eq('contact_id', id).eq('id', body.phoneId)
  if (error) return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 })
  await logActivity(ctx.orgId, ctx.userId, 'contact.phone_primary', 'contact', id, {})
  return NextResponse.json({ ok: true })
}
