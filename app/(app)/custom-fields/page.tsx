// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str } from '@/lib/supabase/helpers'
import CustomFieldsManager from '@/components/custom-fields-manager'

export default async function CustomFieldsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let fields: { id: string; label: string; key: string; type: string }[] = []
  if (db) {
    const { data } = await db.from('custom_fields').select('id, label, key, type')
      .eq('organization_id', ctx.orgId).order('created_at', { ascending: true })
    fields = ((data ?? []) as unknown as { id: string; label: string | null; key: string | null; type: string | null }[])
      .map(f => ({ id: str(f.id), label: str(f.label), key: str(f.key), type: str(f.type) || 'text' }))
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Champs personnalisés</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Ajoutez vos propres métadonnées (secteur, canal, référent…) cohérentes avec vos segments et exports.
        </p>
      </div>
      <CustomFieldsManager fields={fields} canWrite={canWrite(ctx)} orgId={ctx.orgId} />
    </div>
  )
}
