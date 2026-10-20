// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str } from '@/lib/supabase/helpers'
import TagManager from '@/components/tag-manager'

export default async function TagsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let tags: { id: string; name: string; color: string; count: number }[] = []
  if (db) {
    const [tagRes, relRes] = await Promise.all([
      db.from('tags').select('id, name, color').eq('organization_id', ctx.orgId).order('name'),
      db.from('contact_tags').select('tag_id').eq('organization_id', ctx.orgId).limit(20000),
    ])
    const counts = new Map<string, number>()
    for (const r of ((relRes.data ?? []) as unknown as { tag_id: string }[])) {
      counts.set(r.tag_id, (counts.get(r.tag_id) ?? 0) + 1)
    }
    tags = ((tagRes.data ?? []) as unknown as { id: string; name: string | null; color: string | null }[])
      .map(t => ({ id: str(t.id), name: str(t.name), color: str(t.color) || '#2563eb', count: counts.get(str(t.id)) ?? 0 }))
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tags</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Organisez vos contacts : #Client, #Prospect, #Salon2026… utilisables dans les filtres et segments.
        </p>
      </div>
      <TagManager tags={tags} canWrite={canWrite(ctx)} orgId={ctx.orgId} />
    </div>
  )
}
