'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/i18n-provider'

/** Petit bloc actions pour un segment de la liste : suppression + rafraîchissement. */
export default function SegmentsActions({ segmentId }: { segmentId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function del() {
    if (!confirm('Supprimer ce segment ?')) return
    setBusy(true)
    await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', segmentId }),
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <button onClick={del} disabled={busy} className="text-xs hover:underline" style={{ color: 'var(--danger)' }}>
      {busy ? '...' : t.common.delete.toLowerCase()}
    </button>
  )
}
