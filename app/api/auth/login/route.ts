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
  if (!supabase) return NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email.toLowerCase().trim(),
    password: body.password,
  })
  if (error || !data?.user) {
    const msg = error?.message ?? ''
    // Gérer le cas où l'email n'est pas confirmé
    const isUnconfirmed = /email.*not.*confirmed|confirm.*email|please.*confirm/i.test(msg)
    const fr = isUnconfirmed
      ? 'Email non confirmé — vérifiez votre boîte mail et cliquez sur le lien de confirmation.'
      : /invalid login credentials/i.test(msg)
        ? 'Email ou mot de passe incorrect.'
        : /rate limit/i.test(msg)
          ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : 'Connexion impossible. Vérifiez vos identifiants.'
    return NextResponse.json({ error: fr, isEmailUnconfirmed: isUnconfirmed }, { status: 401 })
  }

  // les cookies sb-* ont été écrits par le client SSR (setAll)
  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email })
}