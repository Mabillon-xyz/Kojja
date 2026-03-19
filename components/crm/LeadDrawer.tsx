'use client'
import { useState, useTransition } from 'react'
import { Lead, STAGE_LABELS, STAGES, formatRelativeDate } from '@/lib/lead-types'
import { updateLead, updateLeadStage, deleteLead } from '@/app/actions/leads'

type Props = {
  lead: Lead | null
  onClose: () => void
}

export default function LeadDrawer({ lead, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  // Contact fields (editable)
  const [firstName, setFirstName] = useState(lead?.first_name ?? '')
  const [lastName, setLastName] = useState(lead?.last_name ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [companyName, setCompanyName] = useState(lead?.company_name ?? '')
  const [city, setCity] = useState(lead?.city ?? '')
  const [callDate, setCallDate] = useState(
    lead?.call_date ? new Date(lead.call_date).toISOString().slice(0, 16) : ''
  )
  // New fields
  const [contactMeans, setContactMeans] = useState<string[]>(lead?.contact_means ?? [])
  const [linkedinUrl, setLinkedinUrl] = useState(lead?.linkedin_url ?? '')
  const [comment, setComment] = useState(lead?.comment ?? '')
  // CRM fields
  const [nextAction, setNextAction] = useState(lead?.next_action ?? '')
  const [nextActionDate, setNextActionDate] = useState(lead?.next_action_date ?? '')
  const [notes, setNotes] = useState(lead?.notes ?? '')

  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function handleSave() {
    if (!lead) return
    startTransition(async () => {
      await updateLead(lead.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company_name: companyName,
        city,
        call_date: callDate,
        notes,
        next_action: nextAction,
        next_action_date: nextActionDate,
        contact_means: contactMeans,
        comment,
        linkedin_url: linkedinUrl,
      })
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

  function toggleContactMean(val: string) {
    setContactMeans((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    )
  }

  if (!lead) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="font-semibold text-neutral-900">
              {firstName} {lastName}
            </h2>
            {(companyName || city) && (
              <p className="text-sm text-neutral-500">
                {companyName}{city ? ` · ${city}` : ''}
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

          {/* Contact info */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
            </div>
            <div className="mt-2 space-y-2">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
              <Field label="Company" value={companyName} onChange={setCompanyName} />
              <Field label="City" value={city} onChange={setCity} />
              <Field label="Call date" value={callDate} onChange={setCallDate} type="datetime-local" />
            </div>
          </div>

          {/* Contact means */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Contact means</p>
            <div className="flex flex-wrap gap-2">
              {(['WhatsApp', 'SMS', 'Mail', 'LinkedIn'] as const).map((means) => {
                const val = means.toLowerCase()
                const active = contactMeans.includes(val)
                return (
                  <button
                    key={means}
                    type="button"
                    onClick={() => toggleContactMean(val)}
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

          {/* LinkedIn */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">LinkedIn profile</p>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>

          {/* Stage */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Stage</p>
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
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Next action</p>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="E.g. Send the proposal..."
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
              rows={4}
              placeholder="Notes about this coach..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Comment</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Quick note..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Timeline</p>
            <div className="space-y-2">
              <TimelineEvent label="Call request received" date={lead.call_booked_at} />
              {lead.call_date && (
                <TimelineEvent
                  label={`Call ${new Date(lead.call_date) < new Date() ? 'held' : 'scheduled'}`}
                  date={lead.call_date}
                />
              )}
              {lead.stage !== 'call_scheduled' && (
                <TimelineEvent
                  label={`Stage: ${STAGE_LABELS[lead.stage]}`}
                  date={lead.updated_at}
                />
              )}
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            Registered {formatRelativeDate(lead.call_booked_at)}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 px-3 py-2 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-sm font-semibold bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saved ? 'Saved ✓' : isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Delete this lead?</h3>
            <p className="text-sm text-neutral-500 mb-5">
              {lead.first_name} {lead.last_name} will be permanently deleted from the CRM.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
      />
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
          {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
