import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSsrClient } from '@/lib/supabase/server'

const bodySchema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const supabase = await createSsrClient()
  if (!supabase) return NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 })

  const { error } = await supabase.auth.resetPasswordForEmail(body.email.toLowerCase().trim(), {
    redirectTo: `${new URL(req.url).origin}/reset`,
  })
  // pas d'information sur l'existence du compte (anti-énumération)
  return NextResponse.json({ ok: !Boolean(error) })
}
