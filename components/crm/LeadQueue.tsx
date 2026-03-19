'use client'
import { useState, useTransition } from 'react'
import { Lead, getLeadPriority } from '@/lib/lead-types'
import { updateLeadStage } from '@/app/actions/leads'
import LeadCard from './LeadCard'
import LeadDrawer from './LeadDrawer'

type Props = { leads: Lead[] }

function sortLeads(leads: Lead[]): Lead[] {
  const PRIORITY_ORDER = { red: 0, yellow: 1, gray: 2 }
  return [...leads].sort((a, b) => {
    return PRIORITY_ORDER[getLeadPriority(a)] - PRIORITY_ORDER[getLeadPriority(b)]
  })
}

export default function LeadQueue({ leads }: Props) {
  const [selected, setSelected] = useState<Lead | null>(null)
  const [, startTransition] = useTransition()
  const sorted = sortLeads(leads)

  function handleStageChange(id: string, stage: Lead['stage']) {
    startTransition(async () => {
      await updateLeadStage(id, stage)
    })
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-neutral-400">Aucun lead pour l&apos;instant.</p>
        <p className="text-sm text-neutral-400 mt-1">
          Partagez le lien{' '}
          <a href="/book" target="_blank" className="text-neutral-700 underline underline-offset-2 hover:text-neutral-900">
            /book
          </a>{' '}
          pour recevoir vos premiers leads.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {sorted.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpen={setSelected}
            onStageChange={handleStageChange}
          />
        ))}
      </div>

      {selected && (
        <LeadDrawer key={selected.id} lead={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
