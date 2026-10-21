// route privée bloquante (session + cookies) : opt-out instant-navigation + static shell

export const instant = false

import Link from 'next/link'
import { requireOrg, canWrite } from '@/lib/supabase/org-context'
import { serviceDb } from '@/lib/supabase/server'
import { str, fmtDate } from '@/lib/supabase/page-data'
import SegmentsActions from '@/components/segments-actions'

type Rule = { field: string; op: string; value?: string }
type Group = { and: Rule[]; or: Rule[]; not: Rule[] }

const OP_LABEL: Record<string, string> = {
  eq: '=', neq: '≠', contains: 'contient', starts_with: 'commence par',
  is_empty: 'est vide', not_empty: 'non vide', gt: '>', lt: '<',
}
const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nom', company: 'Entreprise', job_title: 'Fonction', source: 'Source',
  notes: 'Notes', country: 'Pays', city: 'Ville', tag: 'Tag', email: 'Email',
  phone_valid: 'Tél. valide',
}

function ruleText(r: Rule): string {
  if (r.op === 'is_empty' || r.op === 'not_empty') return `${FIELD_LABEL[r.field] ?? r.field} ${OP_LABEL[r.op]}`
  return `${FIELD_LABEL[r.field] ?? r.field} ${OP_LABEL[r.op] ?? r.op} ${r.value ?? ''}`
}

function groupText(g: Group): string {
  const parts: string[] = []
  if (g.and.length) parts.push(g.and.map(ruleText).join(' ET '))
  if (g.or.length) parts.push(g.or.map(ruleText).join(' OU '))
  if (g.not.length) parts.push('SAUF ' + g.not.map(ruleText).join(' ET '))
  return parts.join(' · ') || '—'
}

export default async function SegmentsPage() {
  const ctx = await requireOrg()
  const db = serviceDb()

  let segments: { id: string; name: string; description: string | null; rulesText: string[]; createdAt: string }[] = []
  if (db) {
    const { data } = await db.from('segments').select('id, name, description, rules, created_at')
      .eq('organization_id', ctx.orgId).order('created_at', { ascending: false })
    segments = ((data ?? []) as unknown as { id: string; name: string | null; description: string | null; rules: unknown; created_at: string }[]).map(s => ({
      id: str(s.id),
      name: str(s.name),
      description: s.description,
      rulesText: (Array.isArray(s.rules) ? (s.rules as Group[]) : []).map(groupText),
      createdAt: fmtDate(str(s.created_at)),
    }))
  }
  void canWrite

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Filtres dynamiques sauvegardés, réutilisables pour les exports.
          </p>
        </div>
        <Link href="/segments/new" className="btn btn-primary">Nouveau segment</Link>
      </div>

      {segments.length === 0 && (
        <div className="glass-card text-center py-10">
          <p className="text-lg font-semibold">Aucun segment</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Créez votre premier filtre : pays = Cameroun ET ville = Douala ET tél. valide...
          </p>
          <Link href="/segments/new" className="btn btn-primary mt-3">Créer un segment</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {segments.map(s => (
          <div key={s.id} className="glass-card space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{s.name}</h3>
                {s.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>}
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{s.createdAt}</span>
            </div>
            <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {s.rulesText.map((t, i) => <li key={i}>◆ {t}</li>)}
            </ul>
            <div className="flex gap-2 pt-1">
              <Link href={`/exports/new?segment=${s.id}`} className="btn btn-ghost text-xs">Exporter</Link>
              <SegmentsActions segmentId={s.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
