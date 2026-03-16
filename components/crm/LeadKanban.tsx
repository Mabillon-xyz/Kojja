'use client'
import { useState, useTransition } from 'react'
import { Lead, STAGE_LABELS, STAGES, getLeadPriority } from '@/lib/read-leads'
import { updateLeadStage } from '@/app/actions/leads'
import LeadCard from './LeadCard'
import LeadDrawer from './LeadDrawer'

type Props = { leads: Lead[] }

const PRIORITY_DOT: Record<'red' | 'yellow' | 'gray', string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  gray: 'bg-neutral-300',
}

export default function LeadKanban({ leads }: Props) {
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const byStage = STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage)
    return acc
  }, {})

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, targetStage: Lead['stage']) {
    e.preventDefault()
    if (!draggingId) return
    const lead = leads.find((l) => l.id === draggingId)
    if (!lead || lead.stage === targetStage) {
      setDraggingId(null)
      return
    }
    startTransition(async () => {
      await updateLeadStage(draggingId, targetStage)
      setDraggingId(null)
    })
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = byStage[stage]
          return (
            <div
              key={stage}
              className="flex-shrink-0 w-64"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {STAGE_LABELS[stage]}
                </h3>
                <span className="text-xs text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                  {stageLeads.length}
                </span>
              </div>

              {/* Drop zone */}
              <div className="space-y-2 min-h-24 rounded-lg p-1 transition-colors">
                {stageLeads.map((lead) => (
                  <div key={lead.id} className="relative">
                    {/* Priority dot on kanban */}
                    <div className={`absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full ${PRIORITY_DOT[getLeadPriority(lead)]}`} />
                    <div className="pl-2">
                      <LeadCard
                        lead={lead}
                        onOpen={setSelected}
                        draggable
                        onDragStart={handleDragStart}
                      />
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-neutral-300">Déposer ici</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
