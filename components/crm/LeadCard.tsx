'use client'
import { Lead, STAGE_LABELS, getLeadPriority, formatRelativeDate } from '@/lib/lead-types'

type Props = {
  lead: Lead
  onOpen: (lead: Lead) => void
  onStageChange?: (id: string, stage: Lead['stage']) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, id: string) => void
}

const PRIORITY_DOT: Record<'red' | 'yellow' | 'gray', string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  gray: 'bg-neutral-300',
}

const PRIORITY_LABEL: Record<Lead['stage'], (lead: Lead) => string> = {
  call_scheduled: (lead) => {
    if (!lead.call_date) return 'Call not dated'
    const callDate = new Date(lead.call_date)
    const now = new Date()
    if (callDate < now) return 'Call passed — mark done'
    const diffMs = callDate.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 48) return `Call in ${diffHours}h`
    return `Call on ${callDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
  },
  call_done: (lead) => {
    const updated = new Date(lead.updated_at)
    const diffDays = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 7) return `No follow-up for ${diffDays} days`
    return lead.next_action || 'Call done'
  },
  proposal_sent: (lead) => {
    const updated = new Date(lead.updated_at)
    const diffDays = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 7) return `Follow up — ${diffDays} days without reply`
    return lead.next_action || 'Proposal sent'
  },
  customer: () => 'Active customer',
  not_interested: () => 'Not interested',
}

const NEXT_STAGE: Partial<Record<Lead['stage'], { stage: Lead['stage']; label: string }>> = {
  call_scheduled: { stage: 'call_done', label: 'Mark call done' },
  call_done: { stage: 'proposal_sent', label: 'Send proposal' },
  proposal_sent: { stage: 'customer', label: 'Mark as customer' },
}

export default function LeadCard({ lead, onOpen, onStageChange, draggable = false, onDragStart }: Props) {
  const priority = getLeadPriority(lead)
  const subtitle = PRIORITY_LABEL[lead.stage](lead)
  const nextStep = NEXT_STAGE[lead.stage]

  return (
    <div
      className="group bg-white border border-neutral-200 rounded-lg px-4 py-3.5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, lead.id) : undefined}
      onClick={() => onOpen(lead)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[priority]}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">
              {lead.first_name} {lead.last_name}
            </p>
            {lead.company_name && (
              <p className="text-xs text-neutral-500 truncate">
                {lead.company_name}{lead.city ? ` · ${lead.city}` : ''}
              </p>
            )}
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full whitespace-nowrap">
            {STAGE_LABELS[lead.stage]}
          </span>
          <span className="text-xs text-neutral-400">
            {formatRelativeDate(lead.call_booked_at)}
          </span>
        </div>
      </div>

      {nextStep && onStageChange && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStageChange(lead.id, nextStep.stage)
            }}
            className="text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 px-2 py-1 rounded-md transition-colors"
          >
            {nextStep.label} →
          </button>
        </div>
      )}
    </div>
  )
}
