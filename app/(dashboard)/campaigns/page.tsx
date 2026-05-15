export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import CampaignTracker from '@/components/campaigns/CampaignTracker'
import { getLinkedInDailySends, type LinkedInDaySend } from '@/lib/lemlist-linkedin'
import LinkedInSendsChart from '@/components/flows/LinkedInSendsChart'
import { getLemlistDailyEmailSends } from '@/lib/lemlist-email-sends'
import EmailSendsChart from '@/components/flows/EmailSendsChart'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { data: leads }, linkedInSends, emailSends] = await Promise.all([
    supabase
      .from('lemlist_campaigns')
      .select('*')
      .neq('status', 'draft')
      .order('created_at_lemlist', { ascending: false }),
    supabase
      .from('leads')
      .select('lemlist_campaign_id')
      .not('lemlist_campaign_id', 'is', null),
    getLinkedInDailySends(),
    getLemlistDailyEmailSends(),
  ])

  const callsByCampaign: Record<string, number> = {}
  for (const lead of leads ?? []) {
    const id = lead.lemlist_campaign_id as string
    callsByCampaign[id] = (callsByCampaign[id] ?? 0) + 1
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LinkedInSendsChart rows={linkedInSends as LinkedInDaySend[]} />
        <EmailSendsChart rows={emailSends} />
      </div>
      <CampaignTracker campaigns={campaigns ?? []} callsByCampaign={callsByCampaign} />
    </div>
  )
}
