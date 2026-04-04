'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, CheckCircle, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react'

const STAGE_LABELS: Record<string, string> = {
  call_done: 'Call effectué',
  proposal_sent: 'Proposition envoyée',
  customer: 'Client',
  not_interested: 'Pas intéressé',
}

type RecapResult = {
  summary: string
  key_insights: string[]
  next_action: string
  next_action_date: string
  new_stage?: string
}

type HistoryEntry = {
  date: string
  text: string
}

type Props = {
  leadId: string
  onDone: () => void
}

export default function LeadRecapTab({ leadId, onDone }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecapResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/leads/${leadId}/recap`)
      .then((r) => r.json())
      .then((d) => setHistory(d.entries ?? []))
      .catch(() => {})
  }, [leadId])

  async function analyze() {
    if (text.trim().length < 20) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/recap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recap: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analyse échouée')
      setResult(data)
      // Refresh history
      const h = await fetch(`/api/leads/${leadId}/recap`).then((r) => r.json())
      setHistory(h.entries ?? [])
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle size={16} />
          <p className="text-sm font-semibold">Fiche mise à jour</p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Résumé</p>
            <p className="text-sm text-neutral-700">{result.summary}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Points clés</p>
            <ul className="space-y-1">
              {result.key_insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="text-neutral-300 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Next action</p>
              <p className="text-sm text-neutral-700">{result.next_action}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Date</p>
              <p className="text-sm text-neutral-700">
                {new Date(result.next_action_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          {result.new_stage && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Stage mis à jour</p>
              <span className="inline-block text-xs font-medium bg-neutral-900 text-white px-2.5 py-1 rounded-full">
                {STAGE_LABELS[result.new_stage] ?? result.new_stage}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-neutral-900 text-white py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Voir la fiche
          <ChevronRight size={14} />
        </button>

        <button
          onClick={() => { setResult(null); setText('') }}
          className="w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-1"
        >
          Analyser un autre recap
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* New recap form */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Recap du call
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Colle ici le transcript, le résumé, ou tes notes de call...&#10;&#10;Ex: On a discuté des objectifs de Marie, coach en leadership. Elle veut 3 nouveaux clients d'ici juin. Principal frein : pas de process de prospection. Budget OK pour 1750€. Prochaine étape : lui envoyer la proposition d'ici vendredi."
            className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">{text.length} caractères</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={analyze}
          disabled={loading || text.trim().length < 20}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyse en cours...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Analyser avec Claude
            </>
          )}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
            Historique ({history.length})
          </p>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-sm font-medium text-neutral-700">
                    {entry.date
                      ? new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Recap'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-neutral-400 transition-transform ${expandedIdx === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedIdx === i && (
                  <div className="px-4 pb-4 pt-1 border-t border-neutral-100">
                    <p className="text-sm text-neutral-600 whitespace-pre-wrap">{entry.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
