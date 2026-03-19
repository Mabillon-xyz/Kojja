import { readLeads } from '@/lib/read-leads'
import HomeClient from '@/components/dashboard/HomeClient'
import CallsChart from '@/components/dashboard/CallsChart'

const PRIX_CLIENT = 1750 // € par client

function buildChartData(leads: Awaited<ReturnType<typeof readLeads>>) {
  const filtered = leads.filter((l) => {
    const name = `${l.first_name} ${l.last_name}`.toLowerCase()
    return !name.includes('test')
  })

  const counts: Record<string, number> = {}
  for (const lead of filtered) {
    const date = new Date(lead.call_booked_at)
    const key = date.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    counts[key] = (counts[key] ?? 0) + 1
  }

  const sorted = Object.entries(counts).sort(([a], [b]) => {
    const parse = (s: string) => new Date(`1 ${s}`)
    return parse(a).getTime() - parse(b).getTime()
  })

  return sorted.map(([month, calls]) => ({ month, calls }))
}

export default async function DashboardPage() {
  const leads = await readLeads()

  const totalLeads = leads.length
  const customers = leads.filter((l) => l.stage === 'customer').length
  const proposalsSent = leads.filter((l) =>
    ['proposal_sent', 'customer'].includes(l.stage)
  ).length
  const conversionRate = totalLeads > 0 ? Math.round((customers / totalLeads) * 100) : 0
  const revenue = customers * PRIX_CLIENT
  const chartData = buildChartData(leads)

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

      <CallsChart data={chartData} />

      <HomeClient />
    </div>
  )
}
