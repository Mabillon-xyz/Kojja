export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Leads de la semaine</h1>
        <p className="text-neutral-500 text-sm mt-1">Pipeline en construction — disponible après configuration de la pipeline data.</p>
      </div>
      <div className="border border-dashed border-neutral-300 rounded-xl p-12 text-center">
        <p className="text-neutral-400 text-sm">Aucun lead pour le moment.</p>
        <p className="text-neutral-400 text-sm mt-1">Configure tes situations de coaching dans <a href="/settings" className="underline">Paramètres</a>, puis lance la pipeline.</p>
      </div>
    </div>
  )
}
