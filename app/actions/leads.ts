'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Lead } from '@/lib/read-leads'

export async function createLead(formData: FormData) {
  const supabase = await createClient()

  const first_name = (formData.get('first_name') as string)?.trim()
  const last_name = (formData.get('last_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const company_name = (formData.get('company_name') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const call_date = (formData.get('call_date') as string) || null

  if (!first_name || !last_name || !email) {
    throw new Error('Champs obligatoires manquants')
  }

  const { error } = await supabase.from('leads').insert({
    first_name,
    last_name,
    email,
    company_name,
    city,
    phone,
    call_date: call_date || null,
    stage: 'call_scheduled',
  })

  if (error) throw new Error(`createLead: ${error.message}`)
  revalidatePath('/crm')
}

export async function updateLeadStage(id: string, stage: Lead['stage']) {
  const supabase = await createClient()

  const updates: Partial<Lead> = { stage }

  if (stage === 'call_done') {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 3)
    updates.next_action = 'Envoyer la proposition'
    updates.next_action_date = nextDate.toISOString().split('T')[0]
  } else if (stage === 'proposal_sent') {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 7)
    updates.next_action = 'Relancer si pas de réponse'
    updates.next_action_date = nextDate.toISOString().split('T')[0]
  }

  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) throw new Error(`updateLeadStage: ${error.message}`)
  revalidatePath('/crm')
}

export async function updateLeadNotes(
  id: string,
  notes: string,
  next_action: string,
  next_action_date: string,
  contact_means: string[],
  comment: string,
  linkedin_url: string,
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({
      notes,
      next_action: next_action || null,
      next_action_date: next_action_date || null,
      contact_means: contact_means.length > 0 ? contact_means : null,
      comment: comment || null,
      linkedin_url: linkedin_url || null,
    })
    .eq('id', id)

  if (error) throw new Error(`updateLeadNotes: ${error.message}`)
  revalidatePath('/crm')
}

export async function deleteLead(id: string) {
  const supabase = await createClient()
  await supabase.from('leads').delete().eq('id', id)
  revalidatePath('/crm')
}
