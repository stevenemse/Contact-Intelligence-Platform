'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import WorldMapSvg from './world-map-svg'
import Flag from '@/components/flag'

export type PhoneCountry = { iso2: string; callingCode: string; name: string; n: number; invalid: number }
export type City = { name: string; country_iso2: string; n: number }

/**
 * Carte du monde (onglet Carte) : SVG 2D réutilisable + fiche détail par indicatif,
 * classement par provenance, drill-down villes.
 */
export default function WorldMap({ byPhoneCountry, byCity }: {
  byPhoneCountry: PhoneCountry[]
  byCity: City[]
}) {
  const [selected, setSelected] = useState<PhoneCountry | null>(null)
  const maxN = Math.max(1, ...byPhoneCountry.map(p => p.n))

  const mapCountries = useMemo(
    () => byPhoneCountry.map(p => ({ iso2: p.iso2, name: p.name, n: p.n, invalid: p.invalid })),
    [byPhoneCountry]
  )

  const citiesOf = useMemo(
    () => (selected ? byCity.filter(c => c.country_iso2 === selected.iso2) : []),
    [selected, byCity]
  )

  function onSelect(iso2: string) {
    const p = byPhoneCountry.find(x => x.iso2 === iso2) ?? null
    setSelected(sel => sel?.iso2 === iso2 ? null : p)
  }

  return (
    <div className="space-y-4">
      <div className="kpi-card">
        <WorldMapSvg countries={mapCountries} height={460} selectedIso={selected?.iso2} onSelect={onSelect} maxN={maxN} />
      </div>

      <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>
        {selected
          ? <>Pays sélectionné : <b><Flag iso2={selected.iso2} size={13} /> {selected.name} (+{selected.callingCode})</b></>
          : 'Survolez un pays pour le détail, cliquez pour la fiche. Couleur : teal = valides, orange/rouge = partiellement invalides.'}
      </p>

      {selected && (
        <div className="kpi-card">
          <h3 className="font-bold mb-2 flex items-center gap-2"><Flag iso2={selected.iso2} size={18} /> {selected.name} · indicatif +{selected.callingCode}</h3>
          <div className="text-sm mb-3 flex gap-4 flex-wrap">
            <span><b>{selected.n}</b> numéro(s)</span>
            {selected.invalid > 0 && (
              <span style={{ color: 'var(--danger)' }}>
                {selected.invalid} invalide(s) —
                <Link href="/contacts?phoneValid=invalid" className="underline ml-1">les corriger</Link>
              </span>
            )}
          </div>
          <Link href={`/contacts?country=${selected.iso2}`} className="btn btn-ghost text-xs">
            Filtrer les contacts de ce pays →
          </Link>
        </div>
      )}

      {selected && citiesOf.length > 0 && (
        <div className="kpi-card">
          <h3 className="font-bold mb-2">Villes — {selected.name}</h3>
          <ul className="flex flex-wrap gap-2">
            {[...citiesOf].sort((a, b) => b.n - a.n).map(c => (
              <li key={c.name}>
                <Link href={`/contacts?city=${encodeURIComponent(c.name)}`} className="badge badge-teal hover:opacity-90">
                  {c.name} · {c.n}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <h3 className="font-bold mb-3">Provenance des numéros (par indicatif)</h3>
          <ul className="space-y-1">
            {byPhoneCountry.slice(0, 14).map(p => (
              <li
                key={p.iso2}
                className={`flex items-center gap-3 text-sm rounded px-2 py-1 cursor-pointer transition-colors ${selected?.iso2 === p.iso2 ? 'bg-[color:var(--sidebar-active)]' : 'hover:bg-black/5'}`}
                onClick={() => onSelect(p.iso2)}
              >
                <span className="flex items-center gap-1.5 w-14 shrink-0 font-bold"><Flag iso2={p.iso2} size={14} /> +{p.callingCode}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <div className="w-32 rounded-full h-2" style={{ background: 'var(--track)' }}>
                  <div className="h-2 rounded-full" style={{ width: `${(p.n / maxN) * 100}%`, background: 'var(--brand)' }} />
                </div>
                <span className="w-10 text-right" style={{ color: 'var(--text-muted)' }}>{p.n}</span>
              </li>
            ))}
            {byPhoneCountry.length === 0 && <li className="text-sm" style={{ color: 'var(--text-faint)' }}>—</li>}
          </ul>
        </div>
        <div className="kpi-card">
          <h3 className="font-bold mb-3">Top villes (tous pays)</h3>
          <ul className="space-y-1.5">
            {byCity.slice(0, 12).map(c => (
              <li key={`${c.country_iso2}-${c.name}`} className="flex items-center justify-between text-sm">
                <Link href={`/contacts?city=${encodeURIComponent(c.name)}`} className="hover:underline" style={{ color: 'var(--brand-deep)' }}>
                  {c.name} <span className="text-xs" style={{ color: 'var(--text-faint)' }}>({c.country_iso2})</span>
                </Link>
                <span className="badge">{c.n}</span>
              </li>
            ))}
            {byCity.length === 0 && <li className="text-sm" style={{ color: 'var(--text-faint)' }}>—</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
