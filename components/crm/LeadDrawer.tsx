'use client'
import { useState, useTransition } from 'react'
import { Lead, STAGE_LABELS, STAGES, formatRelativeDate } from '@/lib/lead-types'
import { updateLeadNotes, updateLeadStage, deleteLead } from '@/app/actions/leads'

type Props = {
  lead: Lead | null
  onClose: () => void
}

export default function LeadDrawer({ lead, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [nextAction, setNextAction] = useState(lead?.next_action ?? '')
  const [nextActionDate, setNextActionDate] = useState(lead?.next_action_date ?? '')
  const [contactMeans, setContactMeans] = useState<string[]>(lead?.contact_means ?? [])
  const [comment, setComment] = useState(lead?.comment ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(lead?.linkedin_url ?? '')
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset state when lead changes
  if (lead && notes === '' && lead.notes) setNotes(lead.notes)

  function handleSave() {
    if (!lead) return
    startTransition(async () => {
      await updateLeadNotes(lead.id, notes, nextAction, nextActionDate, contactMeans, comment, linkedinUrl)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleStageChange(stage: Lead['stage']) {
    if (!lead) return
    startTransition(async () => {
      await updateLeadStage(lead.id, stage)
    })
  }

  function handleDelete() {
    if (!lead) return
    startTransition(async () => {
      await deleteLead(lead.id)
      onClose()
    })
  }

  if (!lead) return null

  const callDate = lead.call_date ? new Date(lead.call_date) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="font-semibold text-neutral-900">
              {lead.first_name} {lead.last_name}
            </h2>
            {lead.company_name && (
              <p className="text-sm text-neutral-500">
                {lead.company_name}{lead.city ? ` · ${lead.city}` : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Info bloc */}
          <div className="space-y-2">
            <InfoRow label="Email" value={lead.email} href={`mailto:${lead.email}`} />
            {lead.phone && <InfoRow label="Téléphone" value={lead.phone} href={`tel:${lead.phone}`} />}
            {linkedinUrl && <InfoRow label="LinkedIn" value={linkedinUrl} href={linkedinUrl} />}
            {callDate && (
              <InfoRow
                label="Call"
                value={`${callDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${formatRelativeDate(lead.call_date)})`}
              />
            )}
            <InfoRow label="Inscrit" value={formatRelativeDate(lead.call_booked_at)} />
            {lead.message && <InfoRow label="Message" value={lead.message} />}
          </div>

          {/* Contact means */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Moyen de contact</p>
            <div className="flex flex-wrap gap-2">
              {(['WhatsApp', 'SMS', 'Mail', 'LinkedIn'] as const).map((means) => {
                const val = means.toLowerCase()
                const active = contactMeans.includes(val)
                return (
                  <button
                    key={means}
                    type="button"
                    onClick={() =>
                      setContactMeans(active ? contactMeans.filter((m) => m !== val) : [...contactMeans, val])
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    {means}
                  </button>
                )
              })}
            </div>
          </div>

          {/* LinkedIn URL */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Profil LinkedIn</p>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>

          {/* Stage selector */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Stade</p>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={isPending}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    lead.stage === s
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Next action */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Prochaine action</p>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Ex : Envoyer la proposition..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Informations sur ce coach..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Commentaire</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Commentaire rapide..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Timeline</p>
            <div className="space-y-2">
              <TimelineEvent
                label="Demande de call reçue"
                date={lead.call_booked_at}
              />
              {lead.call_date && (
                <TimelineEvent
                  label={`Call ${new Date(lead.call_date) < new Date() ? 'tenu' : 'prévu'}`}
                  date={lead.call_date}
                />
              )}
              {lead.stage !== 'call_scheduled' && (
                <TimelineEvent
                  label={`Stade : ${STAGE_LABELS[lead.stage]}`}
                  date={lead.updated_at}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Supprimer
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-sm font-medium bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {saved ? 'Sauvegardé ✓' : isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Supprimer ce lead ?</h3>
            <p className="text-sm text-neutral-500 mb-5">
              {lead.first_name} {lead.last_name} sera définitivement supprimé du CRM.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-neutral-400 w-20 flex-shrink-0">{label}</span>
      {href ? (
        <a href={href} className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2 truncate">
          {value}
        </a>
      ) : (
        <span className="text-neutral-700">{value}</span>
      )}
    </div>
  )
}

function TimelineEvent({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-300 flex-shrink-0" />
      <div>
        <span className="text-neutral-700">{label}</span>
        <span className="text-neutral-400 ml-2 text-xs">
          {new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
