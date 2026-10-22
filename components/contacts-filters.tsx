'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

export default function ContactsFilters({ countries, sources, tags, country, source, tag, q, phoneValid }: {
  countries: { iso2: string; name: string }[]
  sources: string[]
  tags: string[]
  country: string
  source: string
  tag: string
  q: string
  phoneValid: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [qLocal, setQLocal] = useState(q)

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams()
    if (qLocal) sp.set('q', qLocal)
    const current: Record<string, string> = { country, source, tag, phoneValid, ...params }
    for (const [k, v] of Object.entries(current)) {
      if (v) sp.set(k, v)
    }
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="kpi-card flex flex-wrap gap-3 items-center">
      <form onSubmit={(e) => { e.preventDefault(); go({}) }} className="flex-1 min-w-[260px]">
        <input className="input" value={qLocal} onChange={(e) => setQLocal(e.target.value)}
          placeholder="Rechercher (nom, téléphone, email, entreprise, ville...)" />
      </form>
      <select className="input max-w-[190px]" value={country} onChange={(e) => go({ country: e.target.value })}>
        <option value="">Tous les pays</option>
        {countries.map(c => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
      </select>
      <select className="input max-w-[170px]" value={source} onChange={(e) => go({ source: e.target.value })}>
        <option value="">Toutes les sources</option>
        {sources.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className="input max-w-[150px]" value={tag} onChange={(e) => go({ tag: e.target.value })}>
        <option value="">Tous les tags</option>
        {tags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className="input max-w-[170px]" value={phoneValid} onChange={(e) => go({ phoneValid: e.target.value })}>
        <option value="">Tous les numéros</option>
        <option value="valid">Numéros valides</option>
        <option value="invalid">Numéros invalides</option>
      </select>
      <button onClick={() => { setQLocal(''); router.push(pathname) }}
        className="btn btn-ghost text-xs">Réinitialiser</button>
    </div>
  )
}
