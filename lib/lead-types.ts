// Pure types and utilities — safe to import in client components

export type Lead = {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name: string | null
  city: string | null
  phone: string | null
  message: string | null
  call_date: string | null
  call_booked_at: string
  stage: 'call_scheduled' | 'call_done' | 'proposal_sent' | 'customer' | 'not_interested'
  notes: string
  next_action: string | null
  next_action_date: string | null
  contact_means: string[] | null
  comment: string | null
  linkedin_url: string | null
  created_at: string
  updated_at: string
}

export function getLeadPriority(lead: Lead): 'red' | 'yellow' | 'gray' {
  const now = new Date()

  if (lead.stage === 'call_scheduled' && lead.call_date) {
    const callDate = new Date(lead.call_date)
    if (callDate < now) return 'red'
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    if (callDate < in48h) return 'yellow'
  }

  if (lead.stage === 'call_done' || lead.stage === 'proposal_sent') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (new Date(lead.updated_at) < sevenDaysAgo) return 'red'
  }

  return 'gray'
}

export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 0) {
    const futureDays = Math.abs(diffDays)
    if (futureDays === 1) return 'Demain'
    return `Dans ${futureDays} jours`
  }
  return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
}

export const STAGE_LABELS: Record<Lead['stage'], string> = {
  call_scheduled: 'Call prévu',
  call_done: 'Call fait',
  proposal_sent: 'Proposition',
  customer: 'Client',
  not_interested: 'Pas intéressé',
}

export const STAGES: Lead['stage'][] = [
  'call_scheduled',
  'call_done',
  'proposal_sent',
  'customer',
  'not_interested',
]
