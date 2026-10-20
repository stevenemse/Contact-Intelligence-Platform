// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { segmentBuilderData } from '@/lib/supabase/page-data'
import SegmentBuilder from '@/components/segment-builder'

export default async function NewSegmentPage() {
  const ctx = await requireOrg()
  void canWrite
  const { countries, sources, cities, tags } = await segmentBuilderData(ctx.orgId)

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <Link href="/segments" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
          ← Segments
        </Link>
        <h1 className="text-2xl font-bold mt-2">Nouveau segment</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Combinez des groupes de conditions ET / OU / SAUF. Plusieurs groupes sont évalués en union.
        </p>
      </div>

      <SegmentBuilder tags={tags} sources={sources} countries={countries} cities={cities} orgId={ctx.orgId} />
    </div>
  )
}
