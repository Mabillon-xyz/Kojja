import { createClient } from '@/lib/supabase/server'
import FlowsList, { type WebhookEvent, type DailyCount } from '@/components/flows/FlowsList'
import { getEmailLogs, type EmailLog } from '@/app/actions/email-logs'

export default async function FlowsPage() {
  const supabase = await createClient()

  const [{ data }, { data: allRaw }, { data: kpiClement }, { data: kpiSandro }, emailLogs] = await Promise.all([
    supabase
      .from('webhook_events')
      .select('id, created_at, source, workflow, leads_count, payload')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('webhook_events')
      .select('created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'leads_yet_to_contact_clement')
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'leads_yet_to_contact_sandro')
      .maybeSingle(),
    getEmailLogs(),
  ])

  type LeadsKpi = { count: number; updated_at: string } | null
  const leadsYetToContact: Record<string, LeadsKpi> = {
    clement: kpiClement?.value as LeadsKpi ?? null,
    sandro:  kpiSandro?.value  as LeadsKpi ?? null,
  }

  // Aggregate by day
  const byDay: Record<string, number> = {}
  for (const ev of allRaw ?? []) {
    const day = (ev.created_at as string).slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  }

  // Fill every day between first and today with 0 if missing
  const days = Object.keys(byDay)
  const chartData: DailyCount[] = []
  if (days.length > 0) {
    const start = new Date(days[0])
    const end = new Date()
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      chartData.push({ date: key, count: byDay[key] ?? 0 })
    }
  }

  return <FlowsList events={(data ?? []) as WebhookEvent[]} chartData={chartData} leadsYetToContact={leadsYetToContact} emailLogs={emailLogs as EmailLog[]} />

}
