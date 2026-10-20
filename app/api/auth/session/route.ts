import { NextResponse } from 'next/server'

/**
 * DELETE = déconnexion (utilisée par la sidebar).
 * La connexion / l'inscription passent désormais par /api/auth/login et
 * /api/auth/register qui établissent les cookies Supabase.
 */
export async function DELETE() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  return NextResponse.json({ ok: true })
}
