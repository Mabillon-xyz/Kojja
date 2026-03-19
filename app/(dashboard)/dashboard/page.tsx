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
      label: 'Revenue',
      value: '€' + revenue.toLocaleString('en-GB'),
      sub: `based on €${PRIX_CLIENT.toLocaleString('en-GB')}/customer`,
    },
    {
      label: 'Customers',
      value: customers,
      sub: '"customer" stage',
    },
    {
      label: 'Total leads',
      value: totalLeads,
      sub: 'since launch',
    },
    {
      label: 'Conversion rate',
      value: conversionRate + '%',
      sub: `${proposalsSent} proposal${proposalsSent !== 1 ? 's' : ''} sent`,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Home</h1>
        <p className="text-neutral-500 text-sm mt-1">Product overview.</p>
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
