import { createClient } from '@supabase/supabase-js'

export type ClientRow = {
  id: string
  user_id: string
  name: string
  email: string
  lemlist_api_key: string
  lemlist_account_id?: string
  created_at: string
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getClientByUserId(userId: string): Promise<ClientRow | null> {
  const { data } = await getSupabase()
    .from('clients')
    .select('id, user_id, name, email, lemlist_api_key, lemlist_account_id, created_at')
    .eq('user_id', userId)
    .single()
  return data ?? null
}

export async function getAllClients(): Promise<ClientRow[]> {
  const { data } = await getSupabase()
    .from('clients')
    .select('id, user_id, name, email, lemlist_api_key, lemlist_account_id, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}
