// Server-only — imports next/headers via supabase/server
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/lead-types'

export type { Lead } from '@/lib/lead-types'
export { getLeadPriority, formatRelativeDate, STAGE_LABELS, STAGES } from '@/lib/lead-types'

export async function readLeads(): Promise<Lead[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('call_booked_at', { ascending: false })

  if (error) throw new Error(`readLeads: ${error.message}`)
  return data as Lead[]
}

export async function readLead(id: string): Promise<Lead | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return data as Lead | null
}
