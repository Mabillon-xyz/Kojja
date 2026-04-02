'use client'
import { useState, useEffect } from 'react'
import type { LeadResearch } from '@/lib/lead-types'

type Props = { leadId: string }

type Tab = 'icebreaker' | 'email' | 'linkedin'

const ICP_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-green-100', text: 'text-green-700', label: 'ICP élevé' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'ICP moyen' },
  low: { bg: 'bg-red-100', text: 'text-red-700', label: 'ICP faible' },
}

export default function LeadResearchTab({ leadId }: Props) {
  const [researches, setResearches] = useState<LeadResearch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('icebreaker')
  const [copied, setCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [exportingHtml, setExportingHtml] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/leads/${leadId}/research`)
        if (res.ok) {
          const data = await res.json()
          setResearches(Array.isArray(data) ? data : [])
        }
      } catch {
        // silent
      }
    }
    loadHistory()
  }, [leadId])

  async function runResearch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/research`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'La recherche a échoué')
      setResearches(prev => [data as LeadResearch, ...prev])
      setActiveTab('icebreaker')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  async function exportHTML(research: LeadResearch) {
    setExportingHtml(true)
    try {
      const res = await fetch(
        `/api/leads/${leadId}/research/export?researchId=${research.id}&format=html`
      )
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `research-coach.html`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingHtml(false)
    }
  }

  async function exportPDF(research: LeadResearch) {
    setExportingPdf(true)
    try {
      const res = await fetch(
        `/api/leads/${leadId}/research/export?researchId=${research.id}&format=pdf`
      )
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => win.print(), 500)
      }
    } finally {
      setExportingPdf(false)
    }
  }

  async function copyLinkedIn(research: LeadResearch) {
    const text = research.linkedin_dm ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const latest = researches[0] ?? null
  const history = researches.slice(1)

  return (
    <div className="space-y-5">
      {/* Launch button */}
      <div className="flex items-center gap-3">
        <button
          onClick={runResearch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Recherche en cours...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Lancer la recherche
            </>
          )}
        </button>
        {loading && (
          <span className="text-xs text-neutral-400">Cela peut prendre 30–60 secondes…</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Latest research result */}
      {latest && (
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">
                {new Date(latest.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {latest.icp_match && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ICP_STYLES[latest.icp_match]?.bg} ${ICP_STYLES[latest.icp_match]?.text}`}>
                  {ICP_STYLES[latest.icp_match]?.label}
                </span>
              )}
            </div>
            {/* Export buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportHTML(latest)}
                disabled={exportingHtml}
                title="Télécharger en HTML"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => exportPDF(latest)}
                disabled={exportingPdf}
                title="Exporter en PDF"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Profile summary */}
          {latest.profile_summary && (
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-xs text-neutral-500 mb-1">Profil</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{latest.profile_summary}</p>
            </div>
          )}

          {/* ICP reason */}
          {latest.icp_reason && (
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-xs text-neutral-500 mb-1">Adéquation ICP</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{latest.icp_reason}</p>
            </div>
          )}

          {/* Tabs: Icebreaker / Email / LinkedIn */}
          <div className="px-4 pt-3">
            <div className="flex gap-1 border-b border-neutral-200 mb-3">
              {(['icebreaker', 'email', 'linkedin'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {tab === 'icebreaker' ? 'Accroche' : tab === 'email' ? 'Email' : 'LinkedIn DM'}
                </button>
              ))}
            </div>

            <div className="pb-4">
              {activeTab === 'icebreaker' && (
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {latest.icebreaker || <span className="text-neutral-400 italic">—</span>}
                </p>
              )}

              {activeTab === 'email' && (
                <div className="space-y-2">
                  {latest.email_subject && (
                    <div>
                      <p className="text-xs text-neutral-400 mb-1">Objet</p>
                      <p className="text-sm font-medium text-neutral-700">{latest.email_subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Corps</p>
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {latest.email_body || <span className="italic text-neutral-400">—</span>}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'linkedin' && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap flex-1">
                      {latest.linkedin_dm || <span className="italic text-neutral-400">—</span>}
                    </p>
                    {latest.linkedin_dm && (
                      <button
                        onClick={() => copyLinkedIn(latest)}
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                      >
                        {copied ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Copié
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copier
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {latest.linkedin_dm && (
                    <p className="text-xs text-neutral-400 mt-2">
                      {latest.linkedin_dm.length} / 300 caractères
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${historyOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {history.length} recherche{history.length > 1 ? 's' : ''} précédente{history.length > 1 ? 's' : ''}
          </button>

          {historyOpen && (
            <div className="mt-2 space-y-2">
              {history.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <span className="text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  {r.icp_match && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ICP_STYLES[r.icp_match]?.bg} ${ICP_STYLES[r.icp_match]?.text}`}>
                      {ICP_STYLES[r.icp_match]?.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!latest && !loading && (
        <p className="text-sm text-neutral-400 italic">
          Aucune recherche pour ce lead. Cliquez sur "Lancer la recherche" pour commencer.
        </p>
      )}
    </div>
  )
}
