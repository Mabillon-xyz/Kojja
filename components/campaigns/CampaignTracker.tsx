'use client'

import { useState, useTransition, useMemo } from 'react'
import { RefreshCw, TrendingUp, Users, BarChart2, Phone, ChevronUp, ChevronDown, Linkedin, Mail, MessageSquare } from 'lucide-react'
import { syncCampaignsAction } from '@/app/(dashboard)/campaigns/actions'

export type LemlistCampaignRow = {
  campaign_id: string
  name: string
  status: string
  created_at_lemlist: string | null
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_opened_pct: number
  emails_replied: number
  emails_replied_pct: number
  linkedin_invites_sent: number
  linkedin_invites_accepted: number
  linkedin_acceptance_pct: number
  linkedin_messages_sent: number
  linkedin_messages_replied: number
  linkedin_reply_pct: number
  leads_total: number
  leads_reached: number
  leads_interested: number
  discovery_calls_booked: number
  synced_at: string
}

type SortKey = keyof LemlistCampaignRow
type SortDir = 'asc' | 'desc'

function replyRateBadge(pct: number, sent: number) {
  if (sent === 0) return 'bg-neutral-100 text-neutral-400'
  if (pct >= 4) return 'bg-emerald-50 text-emerald-700'
  if (pct >= 2) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-600'
}

function acceptanceBadge(pct: number, sent: number) {
  if (sent === 0) return 'bg-neutral-100 text-neutral-400'
  if (pct >= 30) return 'bg-emerald-50 text-emerald-700'
  return 'bg-amber-50 text-amber-700'
}

function fmt(n: number, suffix = '') {
  return n === 0 ? '—' : `${n}${suffix}`
}

function fmtPct(n: number, sent: number) {
  if (sent === 0) return '—'
  return `${n.toFixed(1)}%`
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

const TABS = [
  { key: 'running', label: 'En cours' },
  { key: 'paused', label: 'Pause' },
  { key: 'ended', label: 'Terminées' },
]

export default function CampaignTracker({
  campaigns,
  callsByCampaign,
  readOnly = false,
  onSync,
}: {
  campaigns: LemlistCampaignRow[]
  callsByCampaign: Record<string, number>
  readOnly?: boolean
  onSync?: () => Promise<{ synced?: number; timestamp?: string; error?: string }>
}) {
  const [tab, setTab] = useState('running')
  const [sortKey, setSortKey] = useState<SortKey>('created_at_lemlist')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [isPending, startTransition] = useTransition()
  const [syncResult, setSyncResult] = useState<{ synced?: number; timestamp?: string; error?: string } | null>(null)

  const lastSynced = campaigns[0]?.synced_at ?? null

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function handleSync() {
    startTransition(async () => {
      const result = await (onSync ? onSync() : syncCampaignsAction())
      setSyncResult(result)
    })
  }

  function getCallCount(c: LemlistCampaignRow) {
    return callsByCampaign[c.campaign_id] ?? 0
  }

  const filtered = useMemo(() => {
    const base = campaigns.filter(c => c.status === tab)
    return [...base].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'desc' ? bv - av : av - bv
      }
      return sortDir === 'desc'
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv))
    })
  }, [campaigns, tab, sortKey, sortDir])

  // Macro KPIs — calls computed from manual campaign data
  const totalCallsBooked = campaigns.reduce((s, c) => s + getCallCount(c), 0)
  const activeCount = campaigns.filter(c => c.status === 'running').length
  const totalReached = campaigns.reduce((s, c) => s + c.leads_total, 0)
  const totalEmailSent = campaigns.reduce((s, c) => s + c.emails_sent, 0)
  const totalEmailReplied = campaigns.reduce((s, c) => s + c.emails_replied, 0)
  const globalReplyRate = totalEmailSent > 0
    ? ((totalEmailReplied / totalEmailSent) * 100).toFixed(1)
    : '—'
  const totalLinkedInInvites = campaigns.reduce((s, c) => s + c.linkedin_invites_sent, 0)
  const totalLinkedInMessages = campaigns.reduce((s, c) => s + c.linkedin_messages_sent, 0)

  const kpis = [
    {
      label: 'Campagnes actives',
      value: String(activeCount),
      sub: `${campaigns.filter(c => c.status !== 'draft').length} au total`,
      icon: <BarChart2 className="w-4 h-4 text-blue-600" />,
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Leads contactés',
      value: totalReached.toLocaleString('fr-FR'),
      sub: `${campaigns.filter(c => c.leads_total > 0).length} campagnes avec leads`,
      icon: <Users className="w-4 h-4 text-violet-600" />,
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Taux réponse email',
      value: totalEmailSent > 0 ? `${globalReplyRate}%` : '—',
      sub: `${totalEmailReplied} réponses / ${totalEmailSent} envoyés`,
      icon: <TrendingUp className="w-4 h-4 text-amber-600" />,
      iconBg: 'bg-amber-50',
    },
    {
      label: 'Calls bookés',
      value: String(totalCallsBooked),
      sub: totalCallsBooked > 0 ? `répartis sur ${campaigns.filter(c => getCallCount(c) > 0).length} campagnes` : 'aucun call booké pour l\'instant',
      icon: <Phone className="w-4 h-4 text-emerald-600" />,
      iconBg: 'bg-emerald-50',
    },
  ]

  const outreachKpis = [
    {
      label: 'Invitations LinkedIn',
      value: totalLinkedInInvites.toLocaleString('fr-FR'),
      sub: 'personnes contactées sur LinkedIn',
      icon: <Linkedin className="w-4 h-4 text-sky-600" />,
      iconBg: 'bg-sky-50',
    },
    {
      label: 'Premiers messages LinkedIn',
      value: totalLinkedInMessages.toLocaleString('fr-FR'),
      sub: 'messages envoyés après connexion',
      icon: <MessageSquare className="w-4 h-4 text-indigo-600" />,
      iconBg: 'bg-indigo-50',
    },
    {
      label: 'Emails envoyés',
      value: totalEmailSent.toLocaleString('fr-FR'),
      sub: 'via Lemlist (toutes campagnes)',
      icon: <Mail className="w-4 h-4 text-rose-600" />,
      iconBg: 'bg-rose-50',
    },
  ]

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-neutral-300 group-hover:text-neutral-400" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-blue-500" />
      : <ChevronUp className="w-3 h-3 text-blue-500" />
  }

  function Th({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={`px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none group hover:bg-neutral-50 transition-colors ${className}`}
        onClick={() => handleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Campaign Tracker</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {lastSynced ? `Dernière synchro ${timeAgo(lastSynced)}` : 'Aucun sync — lancez le premier sync'}
          </p>
        </div>
        {(!readOnly || onSync) && (
          <button
            onClick={handleSync}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg shadow-sm hover:bg-neutral-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Synchro…' : 'Sync'}
          </button>
        )}
      </div>

      {syncResult?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
          Erreur sync : {syncResult.error}
        </div>
      )}
      {syncResult?.synced !== undefined && !syncResult.error && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
          {syncResult.synced} campagnes synchronisées.
        </div>
      )}

      {/* Macro KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{kpi.label}</p>
              <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>{kpi.icon}</div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-400 mt-1.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Outreach volume KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {outreachKpis.map(kpi => (
          <div key={kpi.label} className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{kpi.label}</p>
              <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>{kpi.icon}</div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-400 mt-1.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200">
        {TABS.map(t => {
          const count = t.key === 'all' ? campaigns.length : campaigns.filter(c => c.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 text-sm font-medium transition-colors rounded-t-lg border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-400'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Campaign table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
          <p className="text-sm text-neutral-400">
            {campaigns.length === 0
              ? 'Aucune campagne — cliquez sur Sync pour charger les données Lemlist.'
              : 'Aucune campagne dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <Th col="name" label="Campagne" className="pl-5 min-w-[220px]" />
                  <Th col="created_at_lemlist" label="Créée le" />
                  <Th col="leads_total" label="Leads" />
                  <Th col="emails_sent" label="Envoyés" />
                  <Th col="emails_opened_pct" label="Ouverture" />
                  <Th col="emails_replied_pct" label="Réponse email" />
                  <Th col="linkedin_acceptance_pct" label="LinkedIn acc." />
                  <Th col="discovery_calls_booked" label="Calls bookés" className="pr-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(c => (
                  <tr key={c.campaign_id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-3 pl-5">
                      <span className="font-medium text-neutral-900 line-clamp-1 max-w-xs" title={c.name}>
                        {c.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-500 text-xs">
                      {c.created_at_lemlist ? new Date(c.created_at_lemlist).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">
                      {fmt(c.leads_total)}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">
                      {fmt(c.emails_sent)}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">
                      {fmtPct(c.emails_opened_pct, c.emails_sent)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${replyRateBadge(c.emails_replied_pct, c.emails_sent)}`}>
                        {fmtPct(c.emails_replied_pct, c.emails_sent)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${acceptanceBadge(c.linkedin_acceptance_pct, c.linkedin_invites_sent)}`}>
                        {fmtPct(c.linkedin_acceptance_pct, c.linkedin_invites_sent)}
                      </span>
                    </td>
                    <td className="px-3 py-3 pr-5">
                      <span className={`font-semibold tabular-nums ${getCallCount(c) > 0 ? 'text-emerald-600' : 'text-neutral-300'}`}>
                        {getCallCount(c) > 0 ? getCallCount(c) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer: benchmark legend */}
          <div className="px-5 py-2.5 border-t border-neutral-100 bg-neutral-50 flex flex-wrap gap-4 text-xs text-neutral-400">
            <span>Réponse email :
              <span className="mx-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">&lt;2%</span>
              <span className="mx-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">2–4%</span>
              <span className="mx-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">≥4% ✓</span>
            </span>
            <span>LinkedIn acc. :
              <span className="mx-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">&lt;30%</span>
              <span className="mx-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">≥30% ✓</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
