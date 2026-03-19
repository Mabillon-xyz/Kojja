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
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-foreground">CRM</h1>
          <p className="text-sm text-neutral-500 dark:text-muted-foreground mt-0.5">
            {leads.length} coach{leads.length !== 1 ? 's' : ''} dans le pipeline
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('queue')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === 'queue'
                  ? 'bg-white dark:bg-background text-neutral-900 dark:text-foreground shadow-sm font-medium'
                  : 'text-neutral-500 dark:text-muted-foreground hover:text-neutral-700 dark:hover:text-foreground/80'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === 'pipeline'
                  ? 'bg-white dark:bg-background text-neutral-900 dark:text-foreground shadow-sm font-medium'
                  : 'text-neutral-500 dark:text-muted-foreground hover:text-neutral-700 dark:hover:text-foreground/80'
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* Add lead button */}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-sm font-medium bg-neutral-900 dark:bg-foreground text-white dark:text-background px-3 py-1.5 rounded-lg hover:bg-neutral-700 dark:hover:bg-foreground/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
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
        <div className="mb-6 bg-neutral-50 dark:bg-muted/50 border border-neutral-200 dark:border-border rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-foreground/80">Partagez votre lien de réservation</p>
            <p className="text-xs text-neutral-400 dark:text-muted-foreground mt-0.5">
              Les coachs qui bookent un call apparaissent automatiquement ici.
            </p>
          </div>
          <a
            href="/book"
            target="_blank"
            className="text-xs font-medium text-neutral-600 dark:text-foreground/70 hover:text-neutral-900 dark:hover:text-foreground bg-white dark:bg-background border border-neutral-200 dark:border-border px-3 py-1.5 rounded-lg hover:border-neutral-400 dark:hover:border-muted-foreground transition-colors whitespace-nowrap"
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
