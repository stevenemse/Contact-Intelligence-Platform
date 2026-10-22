'use client'

import { useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import { toFlag } from '@/lib/geo/flags'
import type { Topology } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'

// re-exporté pour les composants client qui en ont besoin
export { toFlag } from '@/lib/geo/flags'

export type MapCountry = { iso2: string; name: string; n: number; invalid?: number }

const W = 1000
const H = 500

// ISO 3166-1 numérique (id du TopoJSON) → ISO2
export const NUM2ISO: Record<string, string> = {
  '004': 'AF', '008': 'AL', '012': 'DZ', '024': 'AO', '032': 'AR', '051': 'AM', '036': 'AU',
  '040': 'AT', '031': 'AZ', '044': 'BS', '050': 'BD', '112': 'BY', '056': 'BE', '084': 'BZ',
  '204': 'BJ', '064': 'BT', '068': 'BO', '070': 'BA', '072': 'BW', '076': 'BR', '096': 'BN',
  '100': 'BG', '854': 'BF', '108': 'BI', '120': 'CM', '124': 'CA', '140': 'CF', '148': 'TD',
  '152': 'CL', '156': 'CN', '170': 'CO', '178': 'CG', '180': 'CD', '188': 'CR', '384': 'CI',
  '191': 'HR', '192': 'CU', '196': 'CY', '203': 'CZ', '208': 'DK', '214': 'DO', '218': 'EC',
  '818': 'EG', '222': 'SV', '226': 'GQ', '232': 'ER', '233': 'EE', '231': 'ET', '246': 'FI',
  '250': 'FR', '266': 'GA', '270': 'GM', '268': 'GE', '276': 'DE', '288': 'GH', '300': 'GR',
  '304': 'GL', '320': 'GT', '324': 'GN', '624': 'GW', '328': 'GY', '332': 'HT', '340': 'HN',
  '348': 'HU', '352': 'IS', '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE',
  '376': 'IL', '380': 'IT', '388': 'JM', '392': 'JP', '400': 'JO', '398': 'KZ', '404': 'KE',
  '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '428': 'LV', '422': 'LB',
  '426': 'LS', '430': 'LR', '434': 'LY', '440': 'LT', '442': 'LU', '446': 'MO', '807': 'MK',
  '450': 'MG', '454': 'MW', '458': 'MY', '466': 'ML', '478': 'MR', '484': 'MX', '498': 'MD',
  '496': 'MN', '499': 'ME', '504': 'MA', '508': 'MZ', '104': 'MM', '516': 'NA', '524': 'NP',
  '528': 'NL', '540': 'NC', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '578': 'NO',
  '512': 'OM', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH',
  '616': 'PL', '620': 'PT', '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '682': 'SA',
  '686': 'SN', '688': 'RS', '694': 'SL', '702': 'SG', '703': 'SK', '705': 'SI', '706': 'SO',
  '710': 'ZA', '728': 'SS', '724': 'ES', '144': 'LK', '729': 'SD', '752': 'SE', '756': 'CH',
  '760': 'SY', '158': 'TW', '762': 'TJ', '834': 'TZ', '764': 'TH', '768': 'TG', '788': 'TN',
  '792': 'TR', '795': 'TM', '800': 'UG', '804': 'UA', '784': 'AE', '826': 'GB', '840': 'US',
  '858': 'UY', '860': 'UZ', '862': 'VE', '704': 'VN', '732': 'EH', '887': 'YE', '894': 'ZM',
  '716': 'ZW', '052': 'BB', '048': 'BH', '010': 'AQ', '242': 'FJ', '132': 'CV', '174': 'KM',
  '262': 'DJ', '748': 'SZ',
}

type CountryPath = { iso2: string; name: string; d: string }

// Géométries calculées une seule fois et mises en cache (partagé par dashboard + page carte).
let cachedPaths: CountryPath[] | null = null
function getPaths(): CountryPath[] {
  if (cachedPaths) return cachedPaths
  const topo = worldTopo as unknown as Topology & { objects: { countries: unknown } }
  const geo = feature(topo, topo.objects.countries as never) as unknown as FeatureCollection<Geometry, { name?: string }>
  const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], geo)
  const pathGen = geoPath(projection)
  const out: CountryPath[] = []
  for (const f of geo.features) {
    const id = String(f.id ?? '').padStart(3, '0')
    const iso2 = NUM2ISO[id]
    const d = pathGen(f)
    if (!iso2 || !d) continue
    out.push({ iso2, name: f.properties?.name ?? iso2, d })
  }
  cachedPaths = out
  return out
}

/**
 * Carte du monde SVG réutilisable (2D, sans WebGL).
 * Coloration par volume + taux d'invalidité. Survole → tooltip ; clic → onSelect(iso2).
 */
export default function WorldMapSvg({ countries, height = 300, selectedIso, onSelect, maxN: maxNProp }: {
  countries: MapCountry[]
  height?: number
  selectedIso?: string | null
  onSelect?: (iso2: string) => void
  maxN?: number
}) {
  void height // la carte reste 100 % largeur, ratio imposé par le viewBox
  const paths = useMemo(() => getPaths(), [])
  const [hover, setHover] = useState<{ iso2: string; name: string; x: number; y: number } | null>(null)

  const byIso = useMemo(() => {
    const m = new Map<string, MapCountry>()
    for (const c of countries) m.set(c.iso2, c)
    return m
  }, [countries])
  const maxN = maxNProp ?? Math.max(1, ...countries.map(c => c.n))

  const fill = (iso2: string): string => {
    const c = byIso.get(iso2)
    if (!c) return 'rgba(255,255,255,0.035)'
    const invalid = c.invalid ?? 0
    const rate = invalid / Math.max(1, c.n)
    return rate === 0 ? '#0d9488' : rate > 0.3 ? '#c94c4c' : '#d97706'
  }
  const fillOpacity = (iso2: string): number => {
    const c = byIso.get(iso2)
    if (!c) return 1
    return 0.28 + 0.72 * Math.sqrt(c.n / maxN)
  }

  const hovered = hover ? byIso.get(hover.iso2) : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #0c201c, #081512)', borderRadius: 12 }}
        onMouseLeave={() => setHover(null)}
      >
        {paths.map(c => {
          const active = selectedIso === c.iso2
          return (
            <path
              key={c.iso2}
              d={c.d}
              fill={fill(c.iso2)}
              fillOpacity={fillOpacity(c.iso2)}
              stroke={active ? '#7fd8cc' : '#1d3f38'}
              strokeWidth={active ? 1.4 : 0.4}
              className={onSelect ? 'cursor-pointer transition-[stroke,stroke-width] duration-150' : ''}
              onMouseMove={(e) => setHover({ iso2: c.iso2, name: c.name, x: e.clientX, y: e.clientY })}
              onClick={onSelect ? () => onSelect(c.iso2) : undefined}
            >
              <title>{`${c.name}${byIso.has(c.iso2) ? ` · ${byIso.get(c.iso2)!.n}` : ''}`}</title>
            </path>
          )
        })}
      </svg>

      {hover && (
        <div className="fixed z-50 pointer-events-none" style={{ left: hover.x + 14, top: hover.y - 10 }}>
          <div style={{
            background: 'rgba(10,28,24,.95)', border: '1px solid #134e4a', borderRadius: 9,
            padding: '7px 11px', color: '#e2ece9', fontFamily: 'inherit', fontSize: 12.5, whiteSpace: 'nowrap',
          }}>
            <b>{toFlag(hover.iso2)} {hovered?.name ?? hover.name}</b>
            {hovered ? (
              <>
                {hovered.invalid != null && <span style={{ opacity: .65 }}> · {hovered.n} numéro(s)</span>}
                {hovered.invalid == null && <span style={{ opacity: .65 }}> · {hovered.n} contact(s)</span>}
                {(hovered.invalid ?? 0) > 0 && (
                  <span style={{ color: '#f8a5a5' }}> · {hovered.invalid} invalide(s)</span>
                )}
              </>
            ) : (
              <div style={{ opacity: .6, marginTop: 2 }}>Aucune donnée</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
