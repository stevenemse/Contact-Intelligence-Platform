// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import { requireOrg } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, fmtDate } from '@/lib/supabase/page-data'

const ACTION_LABEL: Record<string, string> = {
  'workspace.created': 'Espace créé',
  'import.done': 'Import terminé',
  'contacts.bulk_delete': 'Contacts supprimés',
  'contact.phone_added': 'Téléphone ajouté',
  'contact.phone_removed': 'Téléphone retiré',
  'contact.phone_primary': 'Téléphone principal changé',
  'contact.tag_added': 'Tag ajouté',
  'contact.tag_removed': 'Tag retiré',
  'tag.created': 'Tag créé',
  'tag.deleted': 'Tag supprimé',
  'custom_field.created': 'Champ personnalisé créé',
  'custom_field.deleted': 'Champ personnalisé supprimé',
  'segment.created': 'Segment créé',
  'segment.deleted': 'Segment supprimé',
  'duplicates.merged': 'Doublons fusionnés',
  'export.generated': 'Export généré',
  'team.invited': 'Membre invité',
  'team.role_changed': 'Rôle modifié',
  'team.member_removed': 'Membre retiré',
  'settings.org_renamed': 'Organisation renommée',
}

type Row = { id: string; action: string; entity: string; entity_id: string | null; details: string; at: string }

export default async function ActivityPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let rows: Row[] = []
  let byAction: { action: string; label: string; n: number }[] = []
  if (db) {
    const { data } = await db.from('activity_logs').select('*')
      .eq('organization_id', ctx.orgId).order('created_at', { ascending: false }).limit(120)
    const all = ((data ?? []) as unknown as Record<string, unknown>[])
    rows = all.map(r => ({
      id: str(r.id),
      action: str(r.action),
      entity: str(r.entity),
      entity_id: (r.entity_id as string | null) ?? null,
      details: (() => { try { return JSON.stringify(r.details ?? {}) } catch { return '' } })(),
      at: fmtDate(str(r.created_at)),
    }))
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.action, (counts.get(r.action) ?? 0) + 1)
    byAction = [...counts.entries()]
      .map(([action, n]) => ({ action, label: ACTION_LABEL[action] ?? action, n }))
      .sort((a, b) => b.n - a.n)
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historique d&apos;activité</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Journal d&apos;audit : imports, exports, fusions, tags, permissions...
        </p>
      </div>

      {byAction.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title mb-2">Aperçu</h3>
          <div className="flex flex-wrap gap-2">
            {byAction.map(a => (
              <span key={a.action} className="badge">{a.label} · {a.n}</span>
            ))}
          </div>
        </div>
      )}

      <div className="kpi-card p-0 overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>Aucune activité</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.at}</td>
                <td className="font-medium">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td><span className="badge">{r.entity || '—'}</span></td>
                <td className="text-xs max-w-[380px] truncate" style={{ color: 'var(--text-secondary)' }}>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
