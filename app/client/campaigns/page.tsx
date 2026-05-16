export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientByUserId } from '@/lib/clients'
import CampaignTracker from '@/components/campaigns/CampaignTracker'
import { syncClientCampaignsSelfAction } from './actions'

export default async function ClientCampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = await getClientByUserId(user.id)
  if (!client) redirect('/login')

  const { data: campaigns } = await supabase
    .from('lemlist_campaigns')
    .select('*')
    .eq('client_id', client.id)
    .neq('status', 'draft')
    .order('created_at_lemlist', { ascending: false })

  return (
    <div className="max-w-7xl">
      <CampaignTracker campaigns={campaigns ?? []} callsByCampaign={{}} readOnly onSync={syncClientCampaignsSelfAction} />
    </div>
  )
}
