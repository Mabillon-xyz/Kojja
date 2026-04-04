'use client'
import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lead, STAGE_LABELS, STAGES, formatRelativeDate } from '@/lib/lead-types'
import { updateLead, updateLeadStage } from '@/app/actions/leads'
import LeadResearchTab from './LeadResearch'
import LeadRecapTab from './LeadRecapTab'

type Props = {
  lead: Lead | null
  onClose: () => void
}

const STAGE_COLORS: Record<Lead['stage'], string> = {
  call_scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  call_done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  proposal_sent: 'bg-amber-50 text-amber-700 border-amber-200',
  customer: 'bg-violet-50 text-violet-700 border-violet-200',
  not_interested: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

export default function LeadDrawer({ lead, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [firstName, setFirstName] = useState(lead?.first_name ?? '')
  const [lastName, setLastName] = useState(lead?.last_name ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [companyName, setCompanyName] = useState(lead?.company_name ?? '')
  const [city, setCity] = useState(lead?.city ?? '')
  const [callDate, setCallDate] = useState(
    lead?.call_date ? new Date(lead.call_date).toISOString().slice(0, 16) : ''
  )
  const [contactMeans, setContactMeans] = useState<string[]>(lead?.contact_means ?? [])
  const [linkedinUrl, setLinkedinUrl] = useState(lead?.linkedin_url ?? '')
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [nextAction, setNextAction] = useState(lead?.next_action ?? '')
  const [nextActionDate, setNextActionDate] = useState(lead?.next_action_date ?? '')

  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'recap' | 'research'>('info')

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
        comment: lead.comment ?? undefined, // preserve existing, no separate UI field
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

  async function handleDelete() {
    if (!lead) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/leads?id=${lead.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setDeleteError(body.error ?? 'Suppression échouée')
      } else {
        router.refresh()
        onClose()
      }
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  function toggleContactMean(val: string) {
    setContactMeans((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    )
  }

  if (!lead) return null

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="border-b border-neutral-100 px-8 pt-6 pb-0 flex-shrink-0">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 select-none">
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 leading-tight">
                    {firstName} {lastName}
                  </h2>
                  {(companyName || city) && (
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {companyName}{city ? ` · ${city}` : ''}
                    </p>
                  )}
                  <span className={`inline-block mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STAGE_COLORS[lead.stage]}`}>
                    {STAGE_LABELS[lead.stage]}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 -mb-px">
              {(['info', 'recap', 'research'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {tab === 'info' ? 'Fiche' : tab === 'recap' ? 'Recap call' : 'Recherche IA'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

            {activeTab === 'research' && (
              <LeadResearchTab leadId={lead.id} />
            )}

            {activeTab === 'recap' && (
              <LeadRecapTab leadId={lead.id} onDone={() => setActiveTab('info')} />
            )}

            {activeTab === 'info' && (
              <>
                {/* Contact */}
                <section>
                  <SectionLabel>Contact</SectionLabel>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Field label="Prénom" value={firstName} onChange={setFirstName} />
                    <Field label="Nom" value={lastName} onChange={setLastName} />
                  </div>
                  <div className="space-y-3">
                    <FieldWithCopy label="Email" value={email} onChange={setEmail} type="email" />
                    <FieldWithCopy label="Téléphone" value={phone} onChange={setPhone} type="tel" />
                    <Field label="Entreprise" value={companyName} onChange={setCompanyName} />
                    <Field label="Ville" value={city} onChange={setCity} />
                    <Field label="Date du call" value={callDate} onChange={setCallDate} type="datetime-local" />
                    <div>
                      <label className="block text-sm font-medium text-neutral-500 mb-1.5">LinkedIn</label>
                      <input
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                      />
                      {linkedinUrl && (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                          Voir le profil →
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* Canaux de contact */}
                <section>
                  <SectionLabel>Canaux de contact</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {(['WhatsApp', 'SMS', 'Mail', 'LinkedIn'] as const).map((means) => {
                      const val = means.toLowerCase()
                      const active = contactMeans.includes(val)
                      return (
                        <button
                          key={means}
                          type="button"
                          onClick={() => toggleContactMean(val)}
                          className={`text-sm px-4 py-2.5 rounded-xl border font-medium transition-colors ${
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
                </section>

                {/* Données entreprise enrichies */}
                {(lead.siren || lead.forme_juridique || lead.effectif || lead.naf_libelle) && (
                  <section>
                    <SectionLabel>Entreprise · données enrichies</SectionLabel>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
                      {lead.siren && <InfoRow label="SIREN" value={lead.siren} />}
                      {lead.forme_juridique && <InfoRow label="Forme juridique" value={lead.forme_juridique} />}
                      {lead.effectif && <InfoRow label="Effectif" value={lead.effectif} />}
                      {lead.naf_libelle && (
                        <InfoRow
                          label="Activité"
                          value={lead.naf_code ? `${lead.naf_code} — ${lead.naf_libelle}` : lead.naf_libelle}
                        />
                      )}
                    </div>
                  </section>
                )}

                {/* Statut */}
                <section>
                  <SectionLabel>Statut</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStageChange(s)}
                        disabled={isPending}
                        className={`text-sm px-4 py-2.5 rounded-xl border font-medium transition-colors ${
                          lead.stage === s
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Prochaine action */}
                <section>
                  <SectionLabel>Prochaine action</SectionLabel>
                  <input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="Ex : Envoyer la proposition, relancer par email…"
                    className="w-full px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="mt-2 w-full px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </section>

                {/* Notes */}
                <section>
                  <SectionLabel>Notes</SectionLabel>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={7}
                    placeholder="Notes libres sur ce coach — contexte, impressions, points importants…"
                    className="w-full px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                </section>

                {/* Historique */}
                <section>
                  <SectionLabel>Historique</SectionLabel>
                  <div className="space-y-3">
                    <TimelineEvent label="Demande reçue" date={lead.call_booked_at} />
                    {lead.call_date && (
                      <TimelineEvent
                        label={`Discovery call ${new Date(lead.call_date) < new Date() ? 'effectué' : 'planifié'}`}
                        date={lead.call_date}
                      />
                    )}
                    {parseFollowUpCalls(lead.notes).map((fu, i) => (
                      <TimelineEvent
                        key={i}
                        label={`Follow-up ${new Date(fu.date) < new Date() ? 'effectué' : 'planifié'}${fu.meetLink ? ' 🎥' : ''}`}
                        date={fu.date}
                        extra={fu.meetLink ? (
                          <a href={fu.meetLink} target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 hover:underline text-xs">
                            Rejoindre →
                          </a>
                        ) : undefined}
                        color="violet"
                      />
                    ))}
                    {lead.stage !== 'call_scheduled' && (
                      <TimelineEvent
                        label={`Statut : ${STAGE_LABELS[lead.stage]}`}
                        date={lead.updated_at}
                      />
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-3">
                    Inscrit {formatRelativeDate(lead.call_booked_at)}
                  </p>
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          {activeTab === 'info' && (
            <div className="px-8 py-4 border-t border-neutral-100 flex items-center justify-between gap-3 flex-shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="text-base font-semibold bg-neutral-900 text-white px-8 py-2.5 rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {saved ? 'Sauvegardé ✓' : isPending ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Supprimer ce lead ?</h3>
            <p className="text-sm text-neutral-500 mb-5">
              {lead.first_name} {lead.last_name} sera définitivement supprimé du CRM.
            </p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
      />
    </div>
  )
}

function FieldWithCopy({
  label, value, onChange, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-500 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
        {value && (
          <button
            type="button"
            onClick={copy}
            title="Copier"
            className="px-3 text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-neutral-400 flex-shrink-0">{label}</span>
      <span className="text-neutral-700 text-right">{value}</span>
    </div>
  )
}

function parseFollowUpCalls(notes: string | null): { date: string; meetLink: string }[] {
  if (!notes) return []
  const results: { date: string; meetLink: string }[] = []
  const re = /\[FOLLOWUP\|([^|]+)\|([^\]]*)\]/g
  let m
  while ((m = re.exec(notes)) !== null) {
    results.push({ date: m[1], meetLink: m[2] })
  }
  return results
}

function TimelineEvent({
  label, date, extra, color = 'neutral',
}: {
  label: string
  date: string
  extra?: React.ReactNode
  color?: 'neutral' | 'violet'
}) {
  const dotClass = color === 'violet' ? 'bg-violet-400' : 'bg-neutral-300'
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-2 w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
      <div>
        <span className="text-sm text-neutral-700">{label}</span>
        <span className="text-neutral-400 ml-2 text-xs">
          {new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
        {extra && <span className="ml-2">{extra}</span>}
      </div>
    </div>
  )
}
