import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSsrClient } from '@/lib/supabase/server'

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) })

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const supabase = await createSsrClient()
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré (lisez SUPABASE-SETUP.md)' }, { status: 503 })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email.toLowerCase().trim(),
    password: body.password,
  })
  if (error || !data?.user) {
    const msg = error?.message ?? ''
    const fr =
      /invalid login credentials/i.test(msg) ? 'Email ou mot de passe incorrect.' :
      /email not confirmed/i.test(msg) ? 'Email non confirmé — vérifiez votre boîte mail.' :
      /rate limit/i.test(msg) ? 'Trop de tentatives. Réessayez dans quelques minutes.' :
      'Connexion impossible. Vérifiez vos identifiants.'
    return NextResponse.json({ error: fr }, { status: 401 })
  }

  // les cookies sb-* ont été écrits par le client SSR (setAll)
  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email })
}
