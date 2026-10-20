import { NextResponse } from 'next/server'
import { createSsrClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createSsrClient()
  if (supabase) await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
