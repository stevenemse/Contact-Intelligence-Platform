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
  if (!admin) return NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 })

  const email = body.email.toLowerCase().trim()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    // NOTE: enlevant email_confirm: true pour activer la vérification email Supabase
    // L'utilisateur recevra un email de confirmation et devra valider avant de se connecter
    user_metadata: { full_name: body.fullName ?? '' },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? ''
    const fr = /password.*weak|weak password/i.test(msg)
      ? 'Mot de passe trop faible (6 caractères minimum).'
      : 'Création du compte impossible.'
    return NextResponse.json({ error: fr }, { status: 400 })
  }

  // NOTE: On ne connecte pas l'utilisateur automatiquement.
  // Il doit vérifier son email d'abord. On retourne quand même un succès
  // pour que le frontend puisse afficher un message "vérifiez votre email".
  return NextResponse.json({ 
    ok: true, 
    userId: created.user.id,
    needsEmailVerification: true,
    email: created.user.email 
  })
}