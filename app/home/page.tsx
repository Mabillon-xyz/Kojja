import { readLeads } from '@/lib/read-leads'
import HomeClient from '@/components/HomeClient'

const PRICE_PER_CUSTOMER = 2000

export default async function HomePage() {
  const leads = await readLeads()

  const totalLeads = leads.length
  const customers = leads.filter((l) => l.stage === 'customer').length
  const proposalsSent = leads.filter((l) =>
    ['proposal_sent', 'customer'].includes(l.stage)
  ).length
  const conversionRate = totalLeads > 0 ? Math.round((customers / totalLeads) * 100) : 0
  const revenue = customers * PRICE_PER_CUSTOMER

  const kpis = [
    {
      label: 'Revenue',
      value: '€' + revenue.toLocaleString('en-GB'),
      sub: `based on €${PRICE_PER_CUSTOMER.toLocaleString('en-GB')}/customer`,
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
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Home</h1>
        <p className="text-muted-foreground text-sm mt-1">Product overview.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className="text-3xl font-semibold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <HomeClient />
    </div>
  )
}
