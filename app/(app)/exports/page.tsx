// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, num, fmtDate } from '@/lib/supabase/page-data'

export default async function ExportsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let runs: { id: string; scope: string; desc: string; cols: number; rows: number; at: string }[] = []
  if (db) {
    const { data } = await db.from('export_runs').select('id, scope, scope_desc, columns, row_count, created_at')
      .eq('organization_id', ctx.orgId).order('created_at', { ascending: false }).limit(30)
    runs = ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
      id: str(r.id),
      scope: str(r.scope),
      desc: str(r.scope_desc),
      cols: Array.isArray(r.columns) ? (r.columns as unknown[]).length : 0,
      rows: num(r.row_count),
      at: fmtDate(str(r.created_at)),
    }))
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exports</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Historique des CSV générés (base entière, segment ou découpe par pays).
          </p>
        </div>
        {canWrite(ctx) && <Link href="/exports/new" className="btn btn-primary">Nouvel export</Link>}
      </div>

      <div className="kpi-card p-0 overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Portée</th><th>Détail</th><th>Colonnes</th><th>Lignes</th><th>Date</th></tr></thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>
                Aucun export — <Link href="/exports/new" className="underline">créez votre premier export</Link>.
              </td></tr>
            )}
            {runs.map(r => (
              <tr key={r.id}>
                <td><span className="badge badge-blue">{r.scope === 'segment' ? 'segment' : r.scope === 'countries' ? 'par pays' : 'base entière'}</span></td>
                <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.desc || '—'}</td>
                <td>{r.cols}</td>
                <td>{r.rows.toLocaleString('fr-FR')}</td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
