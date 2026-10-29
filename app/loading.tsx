// Fallback racine (Suspense du layout racine) : affiché pendant le premier
// rendu de la landing / login / pricing et lors des navigations entre routes
// de premier niveau. Sans lui, un clic donne l'impression de ne rien faire.
export default function RootLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="loader-ring" aria-hidden="true" />
      <p>Chargement…</p>
    </div>
  )
}
