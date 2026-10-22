import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

export const instant = false

const bodySchema = z.object({
  fixes: z.array(z.object({
    phoneId: z.string().uuid(),
    e164: z.string().regex(/^\+[0-9]{6,20}$/),
  })).min(1).max(5000),
})

/** Applique les corrections validées : met à jour raw, normalized, e164, is_valid, country_code. */
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!canWrite(ctx)) return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  const db = serviceDb()
  if (!db) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }

  let applied = 0
  const errors: string[] = []

  // application par lots de 100
  for (let i = 0; i < body.fixes.length; i += 100) {
    const chunk = body.fixes.slice(i, i + 100)
    await Promise.all(chunk.map(async (f) => {
      // revérifier la validité côté serveur (ne jamais faire confiance au client)
      const p = parsePhoneNumberFromString(f.e164)
      if (!p || !p.isValid()) { errors.push(`${f.e164} : reste invalide, ignoré`); return }

      // s'assurer que le téléphone appartient bien à cette org
      const { data: own } = await db.from('contact_phones')
        .select('id').eq('id', f.phoneId).eq('organization_id', ctx.orgId).limit(1)
      if (!own || own.length === 0) { errors.push(`${f.phoneId} : introuvable`); return }

      const { error } = await db.from('contact_phones').update({
        raw_phone: f.e164,
        normalized_phone: p.formatInternational(),
        e164: p.format('E.164'),
        country_code: p.country ?? null,
        is_valid: true,
      }).eq('id', f.phoneId).eq('organization_id', ctx.orgId)
      if (error) errors.push(`${f.e164} : mise à jour impossible`)
      else applied++
    }))
  }

  await logActivity(ctx.orgId, ctx.userId, 'phone_fix.applied', 'contacts', null, {
    applied, requested: body.fixes.length,
  })

  return NextResponse.json({ ok: true, applied, errors })
}
