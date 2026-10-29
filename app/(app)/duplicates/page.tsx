// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { dupDetectionData } from '@/lib/supabase/page-data'
import DupGroupList from '@/components/dup-group-list'

export default async function DuplicatesPage() {
  const ctx = await requireOrg()
  const { groups, contacts, totalDupes } = await dupDetectionData(ctx.orgId)
  const writable = canWrite(ctx)

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Doublons</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {groups.length > 0
            ? `${groups.length} groupe(s) · ${totalDupes} contact(s) en excès à fusionner`
            : 'Détection par téléphone normalisé primaire.'}
        </p>
        {groups.length === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
            Rappel : les « lignes déjà en base » d’un import sont des doublons ignorés —
            elles ne créent pas de fiche et n’apparaissent pas ici. Les contacts à fusionner
            sont des fiches distinctes partageant le même numéro.
          </p>
        )}
      </div>

      <DupGroupList groups={groups} contacts={contacts} canWrite={writable} />
    </div>
  )
}
