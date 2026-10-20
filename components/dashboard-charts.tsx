'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'

/* Palette claire cohérente avec la maquette : teal → vert + nuances neutres */
const COLORS = [
  '#0d9488', '#14b8a6', '#5eead4', '#0a7a70',
  '#0b6b5d', '#34d399', '#88dbd2', '#a6e9e0',
]

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5eae7',
  borderRadius: 10,
  color: '#16211d',
  fontSize: 13,
  boxShadow: '0 6px 20px rgba(13,31,26,.12)',
}

const AXIS_TICK = { fontSize: 12, fill: '#6b7f78' }

function renderPieLabel(props: { name?: string | number; percent?: number }) {
  const { name, percent } = props
  if (!percent || percent < 0.06 || name == null) return null
  return `${String(name)} ${Math.round(percent * 100)}%`
}

export default function DashboardCharts({ geo, cities }: {
  geo: { iso2: string | null; name: string | null; n: number }[]
  cities: { name: string | null; n: number }[]
}) {
  const geoData = geo.slice(0, 8).map(g => ({ name: g.name ?? '—', n: g.n }))
  const cityData = cities.slice(0, 8).map(c => ({ name: c.name ?? '—', n: c.n }))

  const emptyState = (
    <div style={{
      height: 224, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 13,
    }}>
      Aucune donnée pour l&apos;instant
    </div>
  )

  const wrapStyle = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 } as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
      {/* Pie — pays */}
      <div>
        <p style={wrapStyle}>Par pays</p>
        <div style={{ height: 224 }}>
          {geoData.length === 0 ? emptyState : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={geoData}
                  dataKey="n"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={3}
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {geoData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v), 'Contacts']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bar — villes */}
      <div>
        <p style={wrapStyle}>Top villes</p>
        <div style={{ height: 224 }}>
          {cityData.length === 0 ? emptyState : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="#eef1ef" />
                <XAxis type="number" hide tick={AXIS_TICK} />
                <YAxis type="category" dataKey="name" width={86} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [Number(v), 'Contacts']}
                  cursor={{ fill: 'rgba(13,148,136,.06)' }}
                />
                <Bar dataKey="n" radius={[0, 6, 6, 0]} fill="#0d9488" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
