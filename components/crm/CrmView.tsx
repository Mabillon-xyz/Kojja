'use client'
import { useState } from 'react'
import { Lead } from '@/lib/lead-types'
import LeadQueue from './LeadQueue'
import LeadKanban from './LeadKanban'
import AddLeadForm from './AddLeadForm'
import { Plus, LayoutList, Kanban, BrainCircuit, Loader2 } from 'lucide-react'

export default function CrmView({ leads }: { leads: Lead[] }) {
  const [view, setView] = useState<'queue' | 'pipeline'>('pipeline')
  const [showAdd, setShowAdd] = useState(false)
  const [batchState, setBatchState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)

  async function runBatchResearch() {
    setBatchState('loading')
    setBatchProgress(null)
    try {
      // Step 1: get list of leads that need research
      const res = await fetch('/api/leads/research/batch')
      const pending: { id: string; name: string }[] = await res.json()
      if (!pending.length) {
        setBatchState('done')
        setBatchProgress({ done: 0, total: 0 })
        setTimeout(() => setBatchState('idle'), 4000)
        return
      }
      setBatchProgress({ done: 0, total: pending.length })

      // Step 2: call each lead's research endpoint sequentially
      // (parallel would saturate Claude API rate limits)
      let done = 0
      for (const lead of pending) {
        try {
          await fetch(`/api/leads/${lead.id}/research`, { method: 'POST' })
        } catch { /* continue */ }
        done++
        setBatchProgress({ done, total: pending.length })
      }

      setBatchState('done')
      setTimeout(() => { setBatchState('idle'); setBatchProgress(null) }, 5000)
    } catch {
      setBatchState('idle')
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">CRM</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {leads.length} coach{leads.length !== 1 ? 'es' : ''} in the pipeline
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('queue')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all ${
                view === 'queue'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Queue
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all ${
                view === 'pipeline'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Pipeline
            </button>
          </div>

          {/* Batch research button */}
          <button
            onClick={runBatchResearch}
            disabled={batchState === 'loading'}
            title="Run AI research for all leads without a research record"
            className="flex items-center gap-1.5 text-sm font-semibold bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {batchState === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BrainCircuit className="w-4 h-4" />
            )}
            {batchState === 'loading' && batchProgress
              ? `${batchProgress.done}/${batchProgress.total}`
              : batchState === 'done' && batchProgress
              ? batchProgress.total === 0 ? 'All done' : `Done (${batchProgress.total})`
              : batchState === 'loading'
              ? 'Loading…'
              : 'Research all'}
          </button>

          {/* Add lead button */}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6">
          <AddLeadForm onClose={() => setShowAdd(false)} />
        </div>
      )}

      {/* Booking link reminder (empty state) */}
      {leads.length === 0 && !showAdd && (
        <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900">Share your booking link</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Coaches who book a call appear here automatically.
            </p>
          </div>
          <a
            href="/book"
            target="_blank"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:border-blue-400 transition-colors whitespace-nowrap shadow-sm"
          >
            /book →
          </a>
        </div>
      )}

      {/* Main content */}
      {view === 'queue' ? (
        <LeadQueue leads={leads} />
      ) : (
        <LeadKanban leads={leads} />
      )}
    </div>
  )
}
