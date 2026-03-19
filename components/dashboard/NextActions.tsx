import { Lead } from '@/lib/lead-types'
import { Phone, Send, AlertTriangle, CalendarClock, Zap } from 'lucide-react'
import Link from 'next/link'

type Urgency = 'overdue' | 'today' | 'upcoming'
type ActionType = 'call' | 'follow_up' | 'proposal' | 'next_action'

type ActionItem = {
  lead: Lead
  action: string
  detail: string
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

    // ── Call scheduled ──────────────────────────────────────────
    if (lead.stage === 'call_scheduled') {
      if (!lead.call_date) {
        items.push({ lead, action: 'No date set — schedule call', detail: 'Call scheduled', urgency: 'overdue', type: 'call' })
      } else {
        const d = new Date(lead.call_date)
        if (d < todayStart) {
          const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000)
          items.push({ lead, action: 'Mark call as done', detail: `Call was ${daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}`, urgency: 'overdue', type: 'call' })
        } else if (d <= todayEnd) {
          const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          items.push({ lead, action: `Call at ${time}`, detail: 'Today', urgency: 'today', type: 'call' })
        } else if (d <= in7Days) {
          const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          items.push({ lead, action: `Call on ${label}`, detail: 'Upcoming', urgency: 'upcoming', type: 'call' })
        }
      }
      continue
    }

    // ── Stale call_done / proposal_sent ─────────────────────────
    if (['call_done', 'proposal_sent'].includes(lead.stage) && new Date(lead.updated_at) < sevenDaysAgo) {
      const days = Math.floor((now.getTime() - new Date(lead.updated_at).getTime()) / 86400000)
      const type: ActionType = lead.stage === 'proposal_sent' ? 'proposal' : 'follow_up'
      items.push({
        lead,
        action: lead.next_action || (lead.stage === 'proposal_sent' ? 'Follow up on proposal' : 'Follow up after call'),
        detail: `${days} days without update`,
        urgency: 'overdue',
        type,
      })
      continue
    }

    // ── next_action_date based ───────────────────────────────────
    if (lead.next_action && lead.next_action_date) {
      const d = new Date(lead.next_action_date); d.setHours(0, 0, 0, 0)
      if (d < todayStart) {
        const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        items.push({ lead, action: lead.next_action, detail: `Due ${label}`, urgency: 'overdue', type: 'next_action' })
      } else if (d <= todayEnd) {
        items.push({ lead, action: lead.next_action, detail: 'Due today', urgency: 'today', type: 'next_action' })
      } else if (d <= in7Days) {
        const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        items.push({ lead, action: lead.next_action, detail: label, urgency: 'upcoming', type: 'next_action' })
      }
    }
  }

  // Sort overdue → today → upcoming, stable
  const ORDER: Record<Urgency, number> = { overdue: 0, today: 1, upcoming: 2 }
  return items.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency])
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ').filter(Boolean)
  const text = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.[0] ?? '?')
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600 flex-shrink-0">
      {text.toUpperCase()}
    </div>
  )
}

const TYPE_ICON: Record<ActionType, React.ReactNode> = {
  call: <Phone className="w-3 h-3" />,
  follow_up: <Zap className="w-3 h-3" />,
  proposal: <Send className="w-3 h-3" />,
  next_action: <CalendarClock className="w-3 h-3" />,
}

const URGENCY_STYLES: Record<Urgency, { section: string; badge: string; dot: string }> = {
  overdue: {
    section: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  today: {
    section: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  upcoming: {
    section: 'text-neutral-500',
    badge: 'bg-neutral-100 text-neutral-600',
    dot: 'bg-neutral-400',
  },
}

const SECTION_LABELS: Record<Urgency, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'This week',
}

const SECTION_ICONS: Record<Urgency, React.ReactNode> = {
  overdue: <AlertTriangle className="w-3.5 h-3.5" />,
  today: <CalendarClock className="w-3.5 h-3.5" />,
  upcoming: <CalendarClock className="w-3.5 h-3.5" />,
}

export default function NextActions({ leads }: { leads: Lead[] }) {
  const items = buildActions(leads)
  const groups: Urgency[] = ['overdue', 'today', 'upcoming']
  const byGroup = Object.fromEntries(
    groups.map((g) => [g, items.filter((i) => i.urgency === g)])
  ) as Record<Urgency, ActionItem[]>
  const total = items.length

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-900">Next Actions</h2>
        </div>
        {total > 0 ? (
          <span className="text-xs font-semibold bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full">
            {total}
          </span>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-neutral-700">All clear!</p>
          <p className="text-xs text-neutral-400 mt-1">No actions pending for the next 7 days.</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {groups.map((urgency) => {
            const groupItems = byGroup[urgency]
            if (groupItems.length === 0) return null
            const s = URGENCY_STYLES[urgency]
            return (
              <div key={urgency}>
                {/* Section label */}
                <div className={`flex items-center gap-1.5 px-5 py-2 bg-neutral-50 ${s.section}`}>
                  {SECTION_ICONS[urgency]}
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {SECTION_LABELS[urgency]}
                  </span>
                  <span className="ml-auto text-xs font-semibold">{groupItems.length}</span>
                </div>

                {/* Items */}
                {groupItems.map((item) => (
                  <Link
                    key={`${item.lead.id}-${item.urgency}`}
                    href="/crm"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group"
                  >
                    <Initials name={`${item.lead.first_name} ${item.lead.last_name}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {item.lead.first_name} {item.lead.last_name}
                        {item.lead.company_name && (
                          <span className="text-neutral-400 font-normal"> · {item.lead.company_name}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${s.section}`}>
                          {TYPE_ICON[item.type]}
                          {item.action}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                        {item.detail}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
