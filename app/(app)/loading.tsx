// Squelette de l'espace connecté : la sidebar et le shell restent montés
// (layout partagé), seule la zone de contenu est remplacée pendant que la
// page (bloquée : instant = false) stream. Le squelette reprend la forme des
// pages — en-tête, rangée de KPI, panneaux — pour que l'attente soit lisible.
function Block({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  return <div className="shimmer" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
}

export default function AppLoading() {
  return (
    <div className="p-4 md:p-8 space-y-6" role="status" aria-live="polite" aria-busy="true">
      {/* en-tête de page */}
      <div className="space-y-2.5">
        <Block w={150} h={11} />
        <Block w={280} h={32} r={10} />
      </div>

      {/* rangée de KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card">
            <Block w="55%" h={11} />
            <div style={{ marginTop: 8 }}><Block w="40%" h={26} r={10} /></div>
          </div>
        ))}
      </div>

      {/* panneaux */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="kpi-card lg:col-span-2"><Block w="100%" h={260} r={10} /></div>
        <div className="kpi-card"><Block w="100%" h={260} r={10} /></div>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
        Chargement de la page…
      </p>
    </div>
  )
}
