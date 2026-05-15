'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncCampaigns } from '@/lib/sync-campaigns'

export async function syncCampaignsAction(): Promise<{ error?: string; synced?: number; timestamp?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await syncCampaigns()
  revalidatePath('/campaigns')
  return result
}
