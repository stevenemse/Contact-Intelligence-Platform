import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSsrClient, serviceDb } from '@/lib/supabase/server'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  fullName: z.string().max(120).optional(),
})

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const admin = serviceDb()
  if (!admin) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  const email = body.email.toLowerCase().trim()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.fullName ?? '' },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? ''
    const fr =
      /already registered|already exists/i.test(msg) ? 'Cet email est déjà utilisé.' :
      /password.*weak|weak password/i.test(msg) ? 'Mot de passe trop faible (6 caractères minimum).' :
      'Création du compte impossible.'
    return NextResponse.json({ error: fr }, { status: 409 })
  }

  const supabase = await createSsrClient()
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: body.password })
  if (signInErr) return NextResponse.json({ error: 'Compte créé, connexion impossible — essayez de vous connecter.' }, { status: 401 })

  return NextResponse.json({ ok: true, userId: created.user.id })
}
