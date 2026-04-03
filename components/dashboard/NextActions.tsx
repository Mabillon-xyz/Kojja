'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lead } from '@/lib/lead-types'
import { Phone, Send, Zap, CalendarClock, CheckCircle2, Check } from 'lucide-react'
import Link from 'next/link'
import { dismissNextAction, markCallDone } from '@/app/actions/leads'

type Urgency = 'overdue' | 'today' | 'upcoming'
type ActionType = 'call' | 'follow_up' | 'proposal' | 'next_action'

type ActionItem = {
  lead: Lead
  action: string
  when: string
  urgency: Urgency
  type: ActionType
}

function buildActions(leads: Lead[]): ActionItem[] {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const items: ActionItem[] = []

  for (const lead of leads) {
    const name = `${lead.first_name} ${lead.last_name}`.toLowerCase()
    if (name.includes('test')) continue
    if (['customer', 'not_interested'].includes(lead.stage)) continue

    if (lead.stage === 'call_scheduled') {
      if (!lead.call_date) {
        items.push({ lead, action: 'Schedule a call', when: 'No date', urgency: 'overdue', type: 'call' })
      } else {
        const d = new Date(lead.call_date)
        if (d < todayStart) {
          const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
          items.push({ lead, action: 'Mark call as done', when: days === 1 ? 'Yesterday' : `${days}d ago`, urgency: 'overdue', type: 'call' })
        } else if (d <= todayEnd) {
          items.push({ lead, action: 'Call scheduled', when: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), urgency: 'today', type: 'call' })
        } else if (d <= in7Days) {
          items.push({ lead, action: 'Upcoming call', when: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), urgency: 'upcoming', type: 'call' })
        }
      }
      continue
    }

    if (['call_done', 'proposal_sent'].includes(lead.stage) && new Date(lead.updated_at) < sevenDaysAgo) {
      const days = Math.floor((now.getTime() - new Date(lead.updated_at).getTime()) / 86400000)
      items.push({
        lead,
        action: lead.next_action || (lead.stage === 'proposal_sent' ? 'Follow up on proposal' : 'Follow up after call'),
        when: `${days}d ago`,
        urgency: 'overdue',
        type: lead.stage === 'proposal_sent' ? 'proposal' : 'follow_up',
      })
      continue
    }

    if (lead.next_action && lead.next_action_date) {
      const d = new Date(lead.next_action_date); d.setHours(0, 0, 0, 0)
      if (d < todayStart) {
        items.push({ lead, action: lead.next_action, when: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), urgency: 'overdue', type: 'next_action' })
      } else if (d <= todayEnd) {
        items.push({ lead, action: lead.next_action, when: 'Today', urgency: 'today', type: 'next_action' })
      } else if (d <= in7Days) {
        items.push({ lead, action: lead.next_action, when: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), urgency: 'upcoming', type: 'next_action' })
      }
    }
  }

  const ORDER: Record<Urgency, number> = { overdue: 0, today: 1, upcoming: 2 }
  return items.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency])
}

const DOT: Record<Urgency, string> = {
  overdue: 'bg-red-500',
  today: 'bg-blue-500',
  upcoming: 'bg-neutral-300',
}

const WHEN_STYLE: Record<Urgency, string> = {
  overdue: 'text-red-600 bg-red-50',
  today: 'text-blue-700 bg-blue-50',
  upcoming: 'text-neutral-500 bg-neutral-100',
}

const TYPE_ICON: Record<ActionType, React.ReactNode> = {
  call: <Phone className="w-3 h-3 shrink-0" />,
  follow_up: <Zap className="w-3 h-3 shrink-0" />,
  proposal: <Send className="w-3 h-3 shrink-0" />,
  next_action: <CalendarClock className="w-3 h-3 shrink-0" />,
}

const GROUP_LABEL: Record<Urgency, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'This week',
}

const GROUP_LABEL_STYLE: Record<Urgency, string> = {
  overdue: 'text-red-500',
  today: 'text-blue-500',
  upcoming: 'text-neutral-400',
}

export default function NextActions({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<string[]>([])

  const allItems = buildActions(leads)
  const items = allItems.filter((item) => !dismissed.includes(`${item.lead.id}-${item.type}`))
  const groups: Urgency[] = ['overdue', 'today', 'upcoming']

  async function handleDone(item: ActionItem, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const key = `${item.lead.id}-${item.type}`
    setDismissed((prev) => [...prev, key])
    if (item.type === 'next_action') {
      await dismissNextAction(item.lead.id)
    } else if (item.type === 'call' && item.urgency === 'overdue') {
      await markCallDone(item.lead.id)
    }
    router.refresh()
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Next Actions</h2>
        {items.length > 0 && (
          <span className="text-xs font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
          <p className="text-sm font-medium text-neutral-700">All clear</p>
          <p className="text-xs text-neutral-400 mt-0.5">No actions due in the next 7 days</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {groups.map((urgency) => {
            const group = items.filter((i) => i.urgency === urgency)
            if (!group.length) return null
            return (
              <div key={urgency}>
                <p className={`px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest ${GROUP_LABEL_STYLE[urgency]}`}>
                  {GROUP_LABEL[urgency]} · {group.length}
                </p>
                {group.map((item) => (
                  <div
                    key={`${item.lead.id}-${item.type}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-neutral-50 transition-colors group/row"
                  >
                    <Link href="/crm" className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.urgency]}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-neutral-900">
                          {item.lead.first_name} {item.lead.last_name}
                        </span>
                        {item.lead.company_name && (
                          <span className="text-sm text-neutral-400"> · {item.lead.company_name}</span>
                        )}
                        <div className={`flex items-center gap-1 text-xs mt-0.5 ${urgency === 'overdue' ? 'text-neutral-500' : urgency === 'today' ? 'text-blue-600' : 'text-neutral-400'}`}>
                          {TYPE_ICON[item.type]}
                          <span>{item.action}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${WHEN_STYLE[item.urgency]}`}>
                        {item.when}
                      </span>
                    </Link>
                    <button
                      onClick={(e) => handleDone(item, e)}
                      title="Mark as done"
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover/row:opacity-100 hover:bg-emerald-100 hover:text-emerald-600 text-neutral-300 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
