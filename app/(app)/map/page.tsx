// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg } from '@/lib/supabase/org-context'
import { mapData } from '@/lib/supabase/page-data'
import WorldMap from '@/components/world-map'

export default async function MapPage() {
  const ctx = await requireOrg()
  const { byPhoneCountry, byCity } = await mapData(ctx.orgId)

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Carte mondiale</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Provenance des numéros par indicatif · {byPhoneCountry.length} pays détecté(s)
        </p>
      </div>

      <WorldMap byPhoneCountry={byPhoneCountry} byCity={byCity} />
    </div>
  )
}
