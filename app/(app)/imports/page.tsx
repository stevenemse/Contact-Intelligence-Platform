// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, num, fmtDate } from '@/lib/supabase/page-data'
import ImportWizard from '@/components/import-wizard'

export default async function ImportsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let imports: {
    id: string; file: string; status: string; source: string
    rows: number; added: number; skipped: number; errors: number; at: string
  }[] = []
  if (db) {
    const { data } = await db.from('import_batches').select('*')
      .eq('organization_id', ctx.orgId).order('created_at', { ascending: false }).limit(30)
    imports = ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
      id: str(r.id),
      file: str(r.file_name),
      status: str(r.status),
      source: str(r.source),
      rows: num(r.total_rows),
      added: num(r.new_contacts),
      skipped: num(r.duplicates_skipped),
      errors: num(r.errors_count),
      at: fmtDate(str(r.created_at)),
    }))
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Imports</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Historique des fichiers CSV traités (normalisation + dédoublonnage).
          </p>
        </div>
        {canWrite(ctx) && <Link href="/imports/new" className="btn btn-primary">Nouvel import</Link>}
      </div>

      <div className="kpi-card p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr><th>Fichier</th><th>Source</th><th>Statut</th><th>Lignes</th><th>Ajoutés</th><th>Doublons</th><th>Erreurs</th><th>Date</th></tr>
          </thead>
          <tbody>
            {imports.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>
                Aucun import — <Link href="/imports/new" className="underline">importez votre premier CSV</Link>.
              </td></tr>
            )}
            {imports.map(i => (
              <tr key={i.id}>
                <td className="font-medium">{i.file}</td>
                <td>{i.source ? <span className="badge">{i.source}</span> : '—'}</td>
                <td><span className={`badge ${i.status === 'done' ? 'badge-green' : 'badge-blue'}`}>{i.status}</span></td>
                <td>{i.rows.toLocaleString('fr-FR')}</td>
                <td style={{ color: 'var(--success)' }}>{i.added.toLocaleString('fr-FR')}</td>
                <td>{i.skipped.toLocaleString('fr-FR')}</td>
                <td style={{ color: i.errors > 0 ? 'var(--danger)' : undefined }}>{i.errors}</td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite(ctx) && (
        <details>
          <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--brand-deep)' }}>
            Importer un autre fichier dans cet espace
          </summary>
          <div className="mt-3">
            <ImportWizard orgId={ctx.orgId} />
          </div>
        </details>
      )}
    </div>
  )
}
