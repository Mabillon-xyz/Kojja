'use client'

import { useState } from 'react'

type StepEvent = {
  step: string
  label?: string
  ok?: boolean
  error?: string
  campaignId?: string
  campaignName?: string
  hypothesis?: string
  rationale?: string
  leadsAdded?: number
  lemlistUrl?: string
}

type State =
  | { status: 'idle' }
  | { status: 'running'; steps: StepEvent[] }
  | { status: 'success'; steps: StepEvent[]; campaignName: string; hypothesis: string; rationale: string; leadsAdded: number; lemlistUrl: string }
  | { status: 'error'; steps: StepEvent[]; message: string }

function stepIcon(step: string) {
  if (step === 'leads_warning') return '⚠'
  if (
    step.endsWith('_done') ||
    step.endsWith('_created') ||
    step.endsWith('_found') ||
    step.endsWith('_added') ||
    step === 'campaign_live' ||
    step === 'spec_done'
  ) return '✓'
  return '·'
}

function stepColor(step: string) {
  if (step === 'leads_warning') return 'text-amber-500'
  if (
    step.endsWith('_done') ||
    step.endsWith('_created') ||
    step.endsWith('_found') ||
    step.endsWith('_added') ||
    step === 'campaign_live' ||
    step === 'spec_done'
  ) return 'text-emerald-500'
  return 'text-neutral-400'
}

export default function CampaignLaunchCard() {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function launch() {
    setState({ status: 'running', steps: [] })

    try {
      const res = await fetch('/api/campaign-auto', { method: 'POST' })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as StepEvent

            if (event.step === 'done' && event.ok) {
              setState((prev) => ({
                status: 'success',
                steps: prev.status === 'running' ? prev.steps : [],
                campaignName: event.campaignName!,
                hypothesis: event.hypothesis!,
                rationale: event.rationale!,
                leadsAdded: event.leadsAdded ?? 0,
                lemlistUrl: event.lemlistUrl!,
              }))
            } else if (event.step === 'error') {
              setState((prev) => ({
                status: 'error',
                steps: prev.status === 'running' ? prev.steps : [],
                message: event.error ?? 'Erreur inconnue',
              }))
            } else {
              setState((prev) => {
                if (prev.status !== 'running') return prev
                return { ...prev, steps: [...prev.steps, event] }
              })
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (e) {
      setState((prev) => ({
        status: 'error',
        steps: prev.status === 'running' ? prev.steps : [],
        message: e instanceof Error ? e.message : 'Erreur réseau',
      }))
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
            Analyse le journal, trouve 30 leads, génère les icebreakers et lance la campagne dans Lemlist.
          </p>
          <button
            onClick={launch}
            className="w-full bg-neutral-900 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Lancer une campagne
          </button>
        </>
      )}

      {state.status === 'running' && (
        <div className="space-y-1.5">
          {state.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`flex-shrink-0 mt-0.5 font-medium ${stepColor(s.step)}`}>
                {stepIcon(s.step)}
              </span>
              <span className="text-neutral-600 leading-relaxed">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-neutral-400 pt-1">
            <div className="w-3 h-3 border border-neutral-300 border-t-neutral-500 rounded-full animate-spin flex-shrink-0" />
            <span>En cours…</span>
          </div>
        </div>
      )}

      {state.status === 'success' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5 text-sm flex-shrink-0">✓</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{state.campaignName}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{state.hypothesis}</p>
              {state.leadsAdded > 0 && (
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                  {state.leadsAdded} leads · campagne live
                </p>
              )}
            </div>
          </div>

          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
            <p className="text-xs text-neutral-500 leading-relaxed">{state.rationale}</p>
          </div>

          <details className="border border-neutral-100 rounded-lg overflow-hidden">
            <summary className="px-3 py-2 text-xs text-neutral-400 cursor-pointer hover:bg-neutral-50 select-none">
              Log ({state.steps.length} étapes)
            </summary>
            <div className="px-3 pb-2 pt-1 space-y-1">
              {state.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`flex-shrink-0 font-medium ${stepColor(s.step)}`}>{stepIcon(s.step)}</span>
                  <span className="text-neutral-500">{s.label}</span>
                </div>
              ))}
            </div>
          </details>

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
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-3">
          {state.steps.length > 0 && (
            <div className="space-y-1 mb-1">
              {state.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`flex-shrink-0 font-medium ${stepColor(s.step)}`}>{stepIcon(s.step)}</span>
                  <span className="text-neutral-500">{s.label}</span>
                </div>
              ))}
            </div>
          )}
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
