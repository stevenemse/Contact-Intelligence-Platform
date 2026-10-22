import { NextResponse } from 'next/server'
import { createSsrClient } from '@/lib/supabase/server'

/** DELETE = déconnexion (utilisée par la sidebar). */
export async function DELETE() {
  const supabase = await createSsrClient()
  if (supabase) await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
