import { readLeads } from '@/lib/read-leads'
import DashboardBanner from '@/components/dashboard/DashboardBanner'
import HomeClient from '@/components/dashboard/HomeClient'
import NextActions from '@/components/dashboard/NextActions'
import DailyCallsChart, { type DayData } from '@/components/dashboard/DailyCallsChart'
import FlowsDailyChart from '@/components/flows/FlowsDailyChart'
import ConversionChart from '@/components/flows/ConversionChart'
import DashboardKPIs from '@/components/dashboard/DashboardKPIs'
import { createClient } from '@/lib/supabase/server'
import type { DailyCount } from '@/components/flows/FlowsList'
import type { Snapshot } from '@/app/api/lemlist/snapshots/route'
import { getAccount } from '@/lib/lemlist-accounts'

const PRIX_CLIENT = 1750

function buildDailyData(leads: Awaited<ReturnType<typeof readLeads>>): DayData[] {
  const scheduled = leads.filter((l) => l.stage === 'call_scheduled')

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

async function fetchClementSnapshots(): Promise<Snapshot[]> {
  const supabase = await createClient()
  const campaignId = getAccount("clement")!.campaignId()
  const { data } = await supabase
    .from("campaign_snapshots")
    .select("id, snapshotted_at, total_leads, booked_leads, conversion_rate, stage_breakdown")
    .eq("campaign_id", campaignId)
    .order("snapshotted_at", { ascending: true })
  if (!data) return []
  // Deduplicate: keep latest snapshot per day
  const byDay = new Map<string, Snapshot>()
  for (const s of data as Snapshot[]) {
    const day = s.snapshotted_at.slice(0, 10)
    if (!byDay.has(day) || s.snapshotted_at > byDay.get(day)!.snapshotted_at) byDay.set(day, s)
  }
  return Array.from(byDay.values()).sort((a, b) => a.snapshotted_at.localeCompare(b.snapshotted_at))
}

async function buildFlowsChartData(): Promise<DailyCount[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('webhook_events')
    .select('created_at')
    .order('created_at', { ascending: true })

  const byDay: Record<string, number> = {}
  for (const ev of data ?? []) {
    const day = (ev.created_at as string).slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  }

  const days = Object.keys(byDay)
  if (days.length === 0) return []

  const result: DailyCount[] = []
  const start = new Date(days[0])
  const end = new Date()
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, count: byDay[key] ?? 0 })
  }
  return result
}

export default async function DashboardPage() {
  const [leads, flowsChartData, snapshots] = await Promise.all([readLeads(), buildFlowsChartData(), fetchClementSnapshots()])

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
      icon: 'TrendingUp',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
      sensitive: true,
    },
    {
      label: 'Customers',
      value: String(customers),
      sub: 'Active clients',
      icon: 'Users',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
      sensitive: true,
    },
    {
      label: 'Total leads',
      value: String(totalLeads),
      sub: 'Since launch',
      icon: 'BarChart2',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      valueColor: 'text-neutral-900',
    },
    {
      label: 'Conversion',
      value: conversionRate + '%',
      sub: `${proposalsSent} proposal${proposalsSent !== 1 ? 's' : ''} sent`,
      icon: 'Target',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-neutral-900',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      <DashboardBanner />

      {/* KPIs */}
      <DashboardKPIs kpis={kpis} />

      {/* Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyCallsChart data={dailyData} />
        <ConversionChart snapshots={snapshots} />
      </div>

      {/* Flows per day chart */}
      <FlowsDailyChart chartData={flowsChartData} />

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
