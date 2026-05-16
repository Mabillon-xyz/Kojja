'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientByUserId } from '@/lib/clients'
import { syncCampaigns } from '@/lib/sync-campaigns'

export async function syncClientCampaignsSelfAction(): Promise<{ synced?: number; timestamp?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = await getClientByUserId(user.id)
  if (!client) return { error: 'Client introuvable' }

  return syncCampaigns({ apiKey: client.lemlist_api_key, clientId: client.id })
}
