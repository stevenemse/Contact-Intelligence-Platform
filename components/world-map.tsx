'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type Country = { iso2: string; name: string; n: number }
type City = { name: string; country_iso2: string; n: number }

// approximate lat/lng per iso2 for the countries we ship (center points)
const COORDS: Record<string, [number, number]> = {
  CM: [5.7, 12.7], FR: [46.6, 2.5], BE: [50.6, 4.7], CH: [46.8, 8.2], CA: [56.1, -106.3],
  US: [39.8, -98.6], GB: [54.4, -2.9], DE: [51.2, 10.4], ES: [40.2, -3.6], IT: [41.9, 12.6],
  NL: [52.2, 5.3], SN: [14.5, -14.5], CI: [7.5, -5.5], NG: [9.1, 8.7], GH: [7.9, -1.0],
  CD: [-2.9, 23.6], GA: [-0.8, 11.6], CG: [-0.7, 15.2], TD: [15.4, 18.7], CF: [6.6, 20.9],
  MA: [31.8, -7.1], DZ: [28.2, 2.6], TN: [34.1, 9.6], ZA: [-30.6, 22.9], KE: [0.2, 37.9],
  RW: [-1.9, 29.9], BI: [-3.4, 29.9], TZ: [-6.4, 34.9], UG: [1.4, 32.3], ET: [9.1, 40.5],
  LU: [49.8, 6.1], PT: [39.5, -8.0], AT: [47.6, 14.1], SE: [60.1, 18.6], NO: [60.5, 8.5],
  DK: [56.3, 9.5], FI: [61.9, 25.7], PL: [52.0, 19.1], TR: [38.9, 35.2], BR: [-14.2, -51.9],
  CN: [35.9, 104.2], IN: [21.1, 78.0], AE: [23.9, 54.3], QA: [25.3, 51.2], SA: [24.0, 45.1],
  RU: [61.5, 100.0],
  // Afrique complète
  BF: [12.2, -1.6], NE: [17.6, 8.1], TG: [8.6, 0.8], BJ: [9.3, 2.3], GM: [13.4, -15.3],
  ML: [17.5, -4.0], LR: [6.4, -9.4], SL: [8.5, -11.8], AO: [-11.2, 17.9], GQ: [1.6, 10.5],
  MZ: [-18.6, 35.5], ZM: [-13.1, 27.8], MG: [-19.0, 46.7], ZW: [-19.0, 29.2], NA: [-22.9, 18.5],
  MW: [-13.3, 34.3], LS: [-29.6, 28.2], BW: [-22.3, 24.7], SZ: [-26.5, 31.5], KM: [-11.9, 43.9],
  MU: [-20.3, 57.6], RE: [-21.1, 55.5], LY: [26.3, 17.2], EG: [26.8, 30.8], DJ: [11.8, 42.6],
  SO: [6.0, 47.5], EH: [24.2, -12.9], SS: [7.3, 30.3], ER: [15.2, 39.8], GN: [9.9, -10.9],
  // Europe complète
  GR: [39.1, 21.8], IE: [53.4, -8.2], HU: [47.2, 19.5], CZ: [49.8, 15.5], SK: [48.7, 19.7],
  UA: [48.4, 31.2], RO: [45.9, 25.0], BG: [42.7, 25.5], HR: [45.6, 16.4], SI: [46.1, 14.8],
  LT: [55.2, 23.9], LV: [56.9, 24.6], EE: [58.6, 25.0], RS: [44.0, 21.0], BA: [43.9, 17.7],
  MK: [41.6, 21.7], AL: [41.2, 20.2], ME: [42.7, 19.4], IS: [64.9, -19.0], BY: [53.7, 28.0],
  MD: [47.4, 28.4], CY: [35.1, 33.4], MT: [35.9, 14.4],
  // Amériques / Asie / Océanie
  MX: [23.6, -102.6], AR: [-38.4, -63.6], CL: [-35.7, -71.5], CO: [4.6, -74.3],
  PE: [-9.2, -75.0], VE: [6.4, -66.6], PK: [30.4, 69.3], BD: [23.7, 90.4],
  ID: [-0.8, 113.9], PH: [12.9, 121.8], MY: [4.2, 101.9], TH: [15.9, 100.9],
  VN: [14.1, 108.3], JP: [36.2, 138.3], KR: [35.9, 127.8], BH: [26.1, 50.5],
  OM: [21.5, 56.1], JO: [30.6, 36.2], LB: [33.9, 35.9], SY: [34.8, 39.0],
  IR: [32.4, 53.7], AU: [-25.3, 133.8], NZ: [-40.9, 174.9],
}

export default function WorldMap({ byCountry, byCity, sources }: {
  byCountry: Country[]
  byCity: City[]
  sources: string[]
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const maxN = Math.max(1, ...byCountry.map(c => c.n))

  const citiesOf = useMemo(
    () => (selected ? byCity.filter(c => c.country_iso2 === selected) : []),
    [selected, byCity]
  )

  const citiesGlobal = useMemo(
    () => [...byCity].sort((a, b) => b.n - a.n).slice(0, 12),
    [byCity]
  )

  const dot = (n: number) => {
    const r = 8 + Math.sqrt(n / maxN) * 26
    const opacity = 0.35 + (n / maxN) * 0.6
    return { r, opacity }
  }

  return (
    <div className="space-y-4">
      <div className="kpi-card">
        <svg viewBox="0 0 1000 520" className="w-full">
          <rect width="1000" height="520" fill="#eaf1ee" rx="12" />
          {/* graticule impression */}
          {[100, 200, 300, 400].map(y => <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="#dde7e3" />)}
          {[150, 300, 450, 600, 750, 900].map(x => <line key={x} y1="0" y2="520" x1={x} x2={x} stroke="#dde7e3" />)}
          {byCountry.map(c => {
            const cc = COORDS[c.iso2]
            if (!cc) return null
            const x = ((cc[1] + 180) / 360) * 1000
            const y = ((90 - cc[0]) / 180) * 460 + 30
            const { r, opacity } = dot(c.n)
            const active = selected === c.iso2
            return (
              <g key={c.iso2} className="cursor-pointer" onClick={() => setSelected(active ? null : c.iso2)}>
                <circle cx={x} cy={y} r={r} fill={active ? '#086158' : '#0d9488'} opacity={opacity} />
                <text x={x} y={y - r - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#16211d">
                  {c.iso2} · {c.n}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {selected ? <>Pays sélectionné : <b>{byCountry.find(c => c.iso2 === selected)?.name ?? selected}</b></>
            : 'Cliquez une bulle pour zoomer sur un pays.'}
        </p>
      </div>

      {selected && citiesOf.length > 0 && (
        <div className="kpi-card">
          <h3 className="font-bold mb-2">
            Villes (drill-down) — {byCountry.find(c => c.iso2 === selected)?.name ?? selected}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {citiesOf.sort((a, b) => b.n - a.n).map(c => (
              <li key={c.name}>
                <Link href={`/contacts?city=${encodeURIComponent(c.name)}`} className="badge badge-teal hover:opacity-90">
                  {c.name} · {c.n}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/contacts?country=${selected}`} className="btn btn-ghost text-xs mt-3 inline-flex">
            Filtrer les contacts sur ce pays →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <h3 className="font-bold mb-3">Classement des pays</h3>
          <ul className="space-y-1.5">
            {[...byCountry].sort((a, b) => b.n - a.n).slice(0, 12).map(c => (
              <li key={c.iso2} className="flex items-center gap-3 text-sm">
                <span className="font-bold w-9">{c.iso2}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <div className="w-40 rounded-full h-2" style={{ background: '#e3e9e6' }}>
                  <div className="h-2 rounded-full" style={{ width: `${(c.n / maxN) * 100}%`, background: 'var(--brand)' }} />
                </div>
                <span className="w-10 text-right" style={{ color: 'var(--text-muted)' }}>{c.n}</span>
              </li>
            ))}
            {byCountry.length === 0 && <li className="text-sm" style={{ color: 'var(--text-faint)' }}>—</li>}
          </ul>
        </div>
        <div className="kpi-card">
          <h3 className="font-bold mb-3">Top villes (tous pays)</h3>
          <ul className="space-y-1.5">
            {citiesGlobal.map(c => (
              <li key={`${c.country_iso2}-${c.name}`} className="flex items-center justify-between text-sm">
                <Link href={`/contacts?city=${encodeURIComponent(c.name)}`} className="hover:underline" style={{ color: 'var(--brand-deep)' }}>
                  {c.name} <span style={{ color: 'var(--text-faint)' }} className="text-xs">({c.country_iso2})</span>
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
