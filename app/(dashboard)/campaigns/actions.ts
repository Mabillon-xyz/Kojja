'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncCampaigns } from '@/lib/sync-campaigns'

export async function syncCampaignsAction(): Promise<{ error?: string; synced?: number; timestamp?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await syncCampaigns()
  revalidatePath('/campaigns')
  return result
}

export async function updateDiscoveryCallsAction(
  campaignId: string,
  delta: 1 | -1,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error: fetchError } = await service
    .from('lemlist_campaigns')
    .select('discovery_calls_booked')
    .eq('campaign_id', campaignId)
    .single()

  if (fetchError || !data) return { error: 'Campaign not found' }

  const newValue = Math.max(0, (data.discovery_calls_booked ?? 0) + delta)

  const { error } = await service
    .from('lemlist_campaigns')
    .update({ discovery_calls_booked: newValue })
    .eq('campaign_id', campaignId)

  if (error) return { error: error.message }

  revalidatePath('/campaigns')
  return {}
}
