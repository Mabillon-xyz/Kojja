'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'
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
    throw new Error('Required fields missing')
  }

  const contact_means = (formData.getAll('contact_means') as string[]).filter(Boolean)
  const comment = (formData.get('comment') as string)?.trim() || null
  const linkedin_url = (formData.get('linkedin_url') as string)?.trim() || null

  const { error } = await supabase.from('leads').insert({
    first_name,
    last_name,
    email,
    company_name,
    city,
    phone,
    call_date: call_date || null,
    stage: 'call_scheduled',
    contact_means: contact_means.length > 0 ? contact_means : null,
    comment,
    linkedin_url,
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
    updates.next_action = 'Send proposal'
    updates.next_action_date = nextDate.toISOString().split('T')[0]
  } else if (stage === 'proposal_sent') {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 7)
    updates.next_action = 'Follow up if no reply'
    updates.next_action_date = nextDate.toISOString().split('T')[0]
  }

  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) throw new Error(`updateLeadStage: ${error.message}`)
  revalidatePath('/crm')
}

export async function updateLead(
  id: string,
  fields: {
    first_name: string
    last_name: string
    email: string
    phone: string
    company_name: string
    city: string
    call_date: string
    notes: string
    next_action: string
    next_action_date: string
    contact_means: string[]
    comment: string
    linkedin_url: string
  },
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({
      first_name: fields.first_name.trim(),
      last_name: fields.last_name.trim(),
      email: fields.email.trim().toLowerCase(),
      phone: fields.phone.trim() || null,
      company_name: fields.company_name.trim() || null,
      city: fields.city.trim() || null,
      call_date: fields.call_date || null,
      notes: fields.notes,
      next_action: fields.next_action || null,
      next_action_date: fields.next_action_date || null,
      contact_means: fields.contact_means.length > 0 ? fields.contact_means : null,
      comment: fields.comment || null,
      linkedin_url: fields.linkedin_url.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(`updateLead: ${error.message}`)
  revalidatePath('/crm')
}

export async function deleteLead(id: string): Promise<{ error?: string }> {
  // Use service role to bypass RLS — delete requires elevated permissions
  const supabase = createDirectClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) {
    console.error('deleteLead error:', error.message)
    return { error: error.message }
  }
  revalidatePath('/crm')
  revalidatePath('/dashboard')
  return {}
}
