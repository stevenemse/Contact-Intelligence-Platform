'use client'

import Link from 'next/link'

export default function Pager({ page, totalPages, total, baseQuery, basePath }: {
  page: number
  totalPages: number
  total: number
  baseQuery: Record<string, string>
  basePath: string
}) {
  function hrefFor(p: number) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(baseQuery)) {
      if (v) sp.set(k, v)
    }
    sp.set('page', String(p))
    return `${basePath}?${sp.toString()}`
  }

  return (
    <div className="flex items-center justify-between text-sm text-[color:var(--text-secondary)]">
      <span>{total} ligne(s) · page {page} / {totalPages}</span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className="btn btn-ghost text-xs">← Précédent</Link>
        )}
        {page < totalPages && (
          <Link href={hrefFor(page + 1)} className="btn btn-ghost text-xs">Suivant →</Link>
        )}
      </div>
    </div>
  )
}
