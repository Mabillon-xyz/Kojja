'use client'

import { useState } from 'react'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'success'
      campaignId: string
      campaignName: string
      hypothesis: string
      rationale: string
      lemlistUrl: string
    }
  | { status: 'error'; message: string }

export default function CampaignLaunchCard() {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function launch() {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/campaign-auto', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setState({ status: 'error', message: data.error ?? 'Erreur inconnue' })
        return
      }
      setState({
        status: 'success',
        campaignId: data.campaignId,
        campaignName: data.campaignName,
        hypothesis: data.hypothesis,
        rationale: data.rationale,
        lemlistUrl: data.lemlistUrl,
      })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Erreur réseau' })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📡</span>
        <h3 className="text-sm font-semibold text-neutral-900">Outbound</h3>
      </div>

      {state.status === 'idle' && (
        <>
          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            Analyse le journal de campagne et lance la prochaine expérience Lemlist — séquence complète, messages générés, email résumé envoyé.
          </p>
          <button
            onClick={launch}
            className="w-full bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Lancer une campagne
          </button>
        </>
      )}

      {state.status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
          <p className="text-xs text-neutral-500 text-center leading-relaxed">
            Analyse du journal en cours…<br />
            <span className="text-neutral-400">Création de la campagne dans Lemlist (~30s)</span>
          </p>
        </div>
      )}

      {state.status === 'success' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5 text-sm">✓</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{state.campaignName}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{state.hypothesis}</p>
            </div>
          </div>

          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
            <p className="text-xs text-neutral-500 leading-relaxed">{state.rationale}</p>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={state.lemlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-neutral-900 text-white text-xs font-medium py-2 px-3 rounded-lg hover:bg-neutral-700 transition-colors"
            >
              Ouvrir dans Lemlist →
            </a>
            <button
              onClick={() => setState({ status: 'idle' })}
              className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-1"
            >
              Nouvelle campagne
            </button>
          </div>

          <p className="text-xs text-neutral-400 text-center">
            Résumé envoyé à contact@clementguiraud.fr
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-xs text-red-600 font-medium mb-1">Erreur</p>
            <p className="text-xs text-red-500 leading-relaxed break-words">{state.message}</p>
          </div>
          <button
            onClick={() => setState({ status: 'idle' })}
            className="w-full text-center text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
