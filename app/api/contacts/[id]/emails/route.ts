import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOrgContext, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/data'

const addSchema = z.object({ action: z.literal('add'), email: z.string().min(3).max(240) })
const delSchema = z.object({ action: z.literal('delete'), emailId: z.string().uuid() })
const bodySchema = z.union([addSchema, delSchema])

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

  const { data: contact } = await db.from('contacts').select('id').eq('organization_id', ctx.orgId).eq('id', id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  if (body.action === 'add') {
    const { count } = await db.from('contact_emails').select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId).eq('contact_id', id)
    const email = body.email.trim()
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.toLowerCase())
    const { error } = await db.from('contact_emails').insert({
      organization_id: ctx.orgId,
      contact_id: id,
      email,
      is_valid: ok,
      is_primary: (count ?? 0) === 0,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity(ctx.orgId, ctx.userId, 'contact.email_added', 'contact', id, { email })
    return NextResponse.json({ ok: true })
  }

  // delete
  const { data: em } = await db.from('contact_emails').select('id, is_primary')
    .eq('organization_id', ctx.orgId).eq('id', body.emailId).eq('contact_id', id).maybeSingle()
  if (!em) return NextResponse.json({ error: 'Email introuvable' }, { status: 404 })
  const { error } = await db.from('contact_emails').delete().eq('id', body.emailId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (em.is_primary) {
    const { data: next } = await db.from('contact_emails').select('id')
      .eq('organization_id', ctx.orgId).eq('contact_id', id).limit(1).maybeSingle()
    if (next) await db.from('contact_emails').update({ is_primary: true }).eq('id', next.id)
  }
  await logActivity(ctx.orgId, ctx.userId, 'contact.email_removed', 'contact', id, {})
  return NextResponse.json({ ok: true })
}
