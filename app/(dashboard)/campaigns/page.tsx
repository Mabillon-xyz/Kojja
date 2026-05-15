export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import CampaignTracker from '@/components/campaigns/CampaignTracker'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { count: totalCallsBooked }] = await Promise.all([
    supabase
      .from('lemlist_campaigns')
      .select('*')
      .neq('status', 'draft')
      .order('emails_replied_pct', { ascending: false }),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('call_booked_at', 'is', null),
  ])

  return (
    <div className="p-6 md:p-8">
      <CampaignTracker campaigns={campaigns ?? []} totalCallsBooked={totalCallsBooked ?? 0} />
    </div>
  )
}
