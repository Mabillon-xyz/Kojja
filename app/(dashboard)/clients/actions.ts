'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syncCampaigns } from '@/lib/sync-campaigns'

export async function createClientAction(data: {
  name: string
  email: string
  password: string
  lemlistApiKey: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = await createServiceClient()

  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: data.email,
    password: data.password,
    user_metadata: { role: 'client', name: data.name },
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: clientError } = await service.from('clients').insert({
    user_id: authData.user.id,
    name: data.name,
    email: data.email,
    lemlist_api_key: data.lemlistApiKey,
  })

  if (clientError) {
    await service.auth.admin.deleteUser(authData.user.id)
    return { error: clientError.message }
  }

  revalidatePath('/clients')
  return { success: true }
}

export async function deleteClientAction(clientId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = await createServiceClient()

  const { data: clientData } = await service
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .single()

  if (!clientData) return { error: 'Client introuvable' }

  const { error } = await service.auth.admin.deleteUser(clientData.user_id)
  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { success: true }
}

export async function syncClientCampaignsAction(
  clientId: string,
): Promise<{ success?: boolean; synced?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = await createServiceClient()

  const { data: clientData } = await service
    .from('clients')
    .select('lemlist_api_key')
    .eq('id', clientId)
    .single()

  if (!clientData) return { error: 'Client introuvable' }

  const result = await syncCampaigns({ apiKey: clientData.lemlist_api_key, clientId })
  revalidatePath('/clients')
  return { ...result, success: !result.error }
}
