'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Video, Globe } from 'lucide-react'

type Step = 'date' | 'form' | 'done'

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateFR(dateStr: string, time: string) {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day.charAt(0).toUpperCase() + day.slice(1)} à ${time}`
}

function FollowUpBooking() {
  const searchParams = useSearchParams()
  const prefilledEmail = searchParams.get('email') ?? ''

  const [today, setToday] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [step, setStep] = useState<Step>('date')
  const [month, setMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState(prefilledEmail)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    setToday(d)
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [])

  // Pre-fill email from URL param after hydration
  useEffect(() => {
    if (prefilledEmail) setEmail(prefilledEmail)
  }, [prefilledEmail])

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setSlots([])
    fetch(`/api/availability?date=${selectedDate}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  function buildCalendar() {
    const year = month.getFullYear(), m = month.getMonth()
    const firstDay = new Date(year, m, 1)
    const lastDay = new Date(year, m + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/followup/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          date: selectedDate,
          time: selectedTime,
          ...(phone ? { phone } : {}),
          ...(message ? { message } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la réservation')
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const cells = buildCalendar()
  const prevMonthDisabled =
    month.getFullYear() === today.getFullYear() && month.getMonth() <= today.getMonth()

  const LeftPanel = (
    <div className="w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 p-6 md:p-8 flex flex-col gap-5">
      <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-base select-none">
        CG
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Clément Guiraud</p>
        <h1 className="text-lg font-semibold text-gray-900">Follow-up Call</h1>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>30 minutes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>Google Meet</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>Europe/Paris</span>
        </div>
      </div>
    </div>
  )

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row overflow-hidden w-full max-w-2xl">
          {LeftPanel}
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
            <h2 className="text-lg font-semibold text-gray-900">Follow-up confirmé !</h2>
            <p className="text-sm text-gray-500">
              Votre call de suivi avec Clément est confirmé.<br />
              Un email de confirmation vous a été envoyé à <strong>{email}</strong>.
            </p>
            {selectedDate && selectedTime && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700 font-medium">
                📅 {formatDateFR(selectedDate, selectedTime)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row overflow-hidden w-full max-w-2xl">
        {LeftPanel}

        <div className="flex-1 p-6 md:p-8 min-w-0">
          {step === 'date' && (
            <>
              <h2 className="text-sm font-semibold text-gray-900 mb-5">Choisissez une date</h2>

              <div className="flex items-center justify-between mb-4">
                <button
                  disabled={prevMonthDisabled}
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  {MONTHS_FR[month.getMonth()]} {month.getFullYear()}
                </span>
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {DAYS_FR.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((date, i) => {
                  if (!date) return <div key={i} />
                  const dateStr = toDateStr(date)
                  const isPast = date < today
                  const isSelected = selectedDate === dateStr
                  const isToday = dateStr === toDateStr(today)
                  return (
                    <div key={i} className="flex items-center justify-center py-0.5">
                      <button
                        disabled={isPast}
                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null) }}
                        className={`w-9 h-9 rounded-full text-sm transition-all font-medium ${
                          isSelected
                            ? 'bg-violet-600 text-white'
                            : isPast
                            ? 'text-gray-300 cursor-not-allowed'
                            : isToday
                            ? 'border-2 border-violet-600 text-violet-600 hover:bg-violet-50'
                            : 'text-gray-800 hover:bg-violet-50 hover:text-violet-700 cursor-pointer'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    </div>
                  )
                })}
              </div>

              {selectedDate && (
                <div className="mt-5">
                  {loadingSlots ? (
                    <p className="text-sm text-gray-400 text-center py-4">Chargement des créneaux…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Aucun créneau disponible pour cette date.</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-gray-500 mb-3">Créneaux disponibles</p>
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTime(slot)}
                            className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                              selectedTime === slot
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'border-gray-200 text-gray-700 hover:border-violet-400 hover:text-violet-600'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                      {selectedTime && (
                        <button
                          onClick={() => setStep('form')}
                          className="mt-4 w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                        >
                          Continuer →
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              <p className="mt-5 text-xs text-gray-400">Tous les créneaux sont affichés en heure de Paris</p>
            </>
          )}

          {step === 'form' && selectedDate && selectedTime && (
            <>
              <button
                onClick={() => setStep('date')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>

              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                <span className="text-violet-500">📅</span>
                <span className="text-sm font-medium text-violet-700">
                  {formatDateFR(selectedDate, selectedTime)}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Jean Dupont"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="jean@entreprise.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Téléphone{' '}
                    <span className="text-xs text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Quelque chose à préparer ?{' '}
                    <span className="text-xs text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Points à aborder, questions, contexte…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Réservation en cours…' : 'Confirmer le follow-up'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FollowUpPage() {
  return (
    <Suspense>
      <FollowUpBooking />
    </Suspense>
  )
}
