'use client'
import { useState } from 'react'
import { Lead } from '@/lib/lead-types'
import LeadQueue from './LeadQueue'
import LeadKanban from './LeadKanban'
import AddLeadForm from './AddLeadForm'

export default function CrmView({ leads }: { leads: Lead[] }) {
  const [view, setView] = useState<'queue' | 'pipeline'>('queue')
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">CRM</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {leads.length} coach{leads.length !== 1 ? 'es' : ''} in the pipeline
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('queue')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === 'queue'
                  ? 'bg-white text-neutral-900 shadow-sm font-medium'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === 'pipeline'
                  ? 'bg-white text-neutral-900 shadow-sm font-medium'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* Add lead button */}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-sm font-medium bg-neutral-900 text-white px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
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
        <div className="mb-6 bg-neutral-50 border border-neutral-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-700">Share your booking link</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Coaches who book a call appear here automatically.
            </p>
          </div>
          <a
            href="/book"
            target="_blank"
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg hover:border-neutral-400 transition-colors whitespace-nowrap"
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
