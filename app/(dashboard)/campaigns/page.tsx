export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import CampaignTracker from '@/components/campaigns/CampaignTracker'
import { getLinkedInDailySends, type LinkedInDaySend } from '@/lib/lemlist-linkedin'
import LinkedInSendsChart from '@/components/flows/LinkedInSendsChart'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { count: totalCallsBooked }, linkedInSends] = await Promise.all([
    supabase
      .from('lemlist_campaigns')
      .select('*')
      .neq('status', 'draft')
      .order('emails_replied_pct', { ascending: false }),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('call_booked_at', 'is', null),
    getLinkedInDailySends(),
  ])

  return (
    <div className="max-w-7xl space-y-6">
      <LinkedInSendsChart rows={linkedInSends as LinkedInDaySend[]} />
      <CampaignTracker campaigns={campaigns ?? []} totalCallsBooked={totalCallsBooked ?? 0} />
    </div>
  )
}
