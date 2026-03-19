import { readLeads } from '@/lib/read-leads'
import HomeClient from '@/components/dashboard/HomeClient'

const PRIX_CLIENT = 2000 // € par client

export default async function DashboardPage() {
  const leads = await readLeads()

  const totalLeads = leads.length
  const customers = leads.filter((l) => l.stage === 'customer').length
  const proposalsSent = leads.filter((l) =>
    ['proposal_sent', 'customer'].includes(l.stage)
  ).length
  const conversionRate = totalLeads > 0 ? Math.round((customers / totalLeads) * 100) : 0
  const revenue = customers * PRIX_CLIENT

  const kpis = [
    {
      label: 'Revenus',
      value: revenue.toLocaleString('fr-FR') + ' €',
      sub: `basé sur ${PRIX_CLIENT.toLocaleString('fr-FR')} €/client`,
    },
    {
      label: 'Clients',
      value: customers,
      sub: 'stage "client"',
    },
    {
      label: 'Leads totaux',
      value: totalLeads,
      sub: 'depuis le lancement',
    },
    {
      label: 'Taux de conversion',
      value: conversionRate + ' %',
      sub: `${proposalsSent} proposition${proposalsSent !== 1 ? 's' : ''} envoyée${proposalsSent !== 1 ? 's' : ''}`,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Home</h1>
        <p className="text-neutral-500 text-sm mt-1">Vue d&apos;ensemble du produit.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className="text-3xl font-semibold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* To Do + Road Map */}
      <HomeClient />
    </div>
  )
}
