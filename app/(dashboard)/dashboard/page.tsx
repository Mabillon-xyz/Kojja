import { readLeads } from '@/lib/read-leads'
import HomeClient from '@/components/dashboard/HomeClient'
import NextActions from '@/components/dashboard/NextActions'
import DailyCallsChart, { type DayData } from '@/components/dashboard/DailyCallsChart'
import { TrendingUp, Users, BarChart2, Target } from 'lucide-react'

const PRIX_CLIENT = 1750

function buildDailyData(leads: Awaited<ReturnType<typeof readLeads>>): DayData[] {
  const scheduled = leads.filter((l) => {
    const name = `${l.first_name} ${l.last_name}`.toLowerCase()
    return l.stage === 'call_scheduled' && !name.includes('test')
  })

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return Array.from({ length: 90 }, (_, i) => {
    const day = new Date(today); day.setDate(day.getDate() - 7 + i)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const isToday = i === 7
    const isPast = day < today

    const calls = scheduled
      .filter((l) => l.call_date && l.call_date.startsWith(iso))
      .map((l) => ({
        name: `${l.first_name} ${l.last_name}`,
        time: l.call_date
          ? new Date(l.call_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : null,
        company: l.company_name,
      }))

    return {
      label: String(day.getDate()),
      sublabel: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      iso,
      count: calls.length,
      calls,
      isToday,
      isPast,
    }
  })
}

export default async function DashboardPage() {
  const leads = await readLeads()

  const totalLeads = leads.length
  const customers = leads.filter((l) => l.stage === 'customer').length
  const proposalsSent = leads.filter((l) => ['proposal_sent', 'customer'].includes(l.stage)).length
  const conversionRate = totalLeads > 0 ? Math.round((customers / totalLeads) * 100) : 0
  const revenue = customers * PRIX_CLIENT
  const dailyData = buildDailyData(leads)

  const kpis = [
    {
      label: 'Revenue',
      value: '€' + revenue.toLocaleString('en-GB'),
      sub: `${customers} client${customers !== 1 ? 's' : ''} × €${PRIX_CLIENT.toLocaleString('en-GB')}`,
      icon: TrendingUp,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Customers',
      value: String(customers),
      sub: 'Active clients',
      icon: Users,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
    },
    {
      label: 'Total leads',
      value: String(totalLeads),
      sub: 'Since launch',
      icon: BarChart2,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      valueColor: 'text-neutral-900',
    },
    {
      label: 'Conversion',
      value: conversionRate + '%',
      sub: `${proposalsSent} proposal${proposalsSent !== 1 ? 's' : ''} sent`,
      icon: Target,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-neutral-900',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{kpi.label}</p>
              <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${kpi.valueColor}`}>{kpi.value}</p>
            <p className="text-xs text-neutral-400 mt-1.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily calls chart — full width */}
      <DailyCallsChart data={dailyData} />

      {/* Next actions + tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NextActions leads={leads} />
        </div>
        <div className="lg:col-span-1">
          <HomeClient />
        </div>
      </div>

    </div>
  )
}
