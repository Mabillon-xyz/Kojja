export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientByUserId } from '@/lib/clients'
import CampaignTracker from '@/components/campaigns/CampaignTracker'
import LinkedInSendsChart from '@/components/flows/LinkedInSendsChart'
import EmailSendsChart from '@/components/flows/EmailSendsChart'
import { getLinkedInDailySends, type LinkedInDaySend } from '@/lib/lemlist-linkedin'
import { getLemlistDailyEmailSends } from '@/lib/lemlist-email-sends'
import { type AccountId } from '@/lib/lemlist-accounts'
import { syncClientCampaignsSelfAction } from './actions'

export default async function ClientCampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = await getClientByUserId(user.id)
  if (!client) redirect('/login')

  const accountId = (client.lemlist_account_id ?? 'clement') as AccountId

  const [{ data: campaigns }, linkedInSends, emailSends] = await Promise.all([
    supabase
      .from('lemlist_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .neq('status', 'draft')
      .order('created_at_lemlist', { ascending: false }),
    getLinkedInDailySends(accountId),
    getLemlistDailyEmailSends(accountId),
  ])

  return (
    <div className="max-w-7xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LinkedInSendsChart rows={linkedInSends as LinkedInDaySend[]} readOnly />
        <EmailSendsChart rows={emailSends} readOnly />
      </div>
      <CampaignTracker campaigns={campaigns ?? []} callsByCampaign={{}} readOnly onSync={syncClientCampaignsSelfAction} />
    </div>
  )
}
