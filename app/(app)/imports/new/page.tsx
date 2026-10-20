// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import ImportWizard from '@/components/import-wizard'

export default async function NewImportPage() {
  const ctx = await requireOrg()
  const writable = canWrite(ctx)

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <Link href="/imports" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Imports</Link>
        <h1 className="text-2xl font-bold mt-2">Nouvel import CSV</h1>
        {writable ? (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Les téléphones sont normalisés au format international et les doublons sont détectés avant insertion.
          </p>
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>Votre rôle est en lecture seule.</p>
        )}
      </div>
      {writable ? (
        <ImportWizard orgId={ctx.orgId} />
      ) : (
        <div className="glass-card text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Lecture seule — demandez un rôle supérieur à un administrateur.
        </div>
      )}
    </div>
  )
}
