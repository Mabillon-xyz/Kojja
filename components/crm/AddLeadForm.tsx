'use client'
import { useState, useTransition, useRef } from 'react'
import { createLead } from '@/app/actions/leads'

export default function AddLeadForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [contactMeans, setContactMeans] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  function toggleMean(val: string) {
    setContactMeans((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    contactMeans.forEach((m) => formData.append('contact_means', m))
    startTransition(async () => {
      try {
        await createLead(formData)
        formRef.current?.reset()
        setContactMeans([])
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
      <h3 className="font-medium text-sm text-neutral-900">Ajouter un lead manuellement</h3>

      <div className="grid grid-cols-2 gap-3">
        <InputField name="first_name" label="Prénom *" placeholder="Claire" required />
        <InputField name="last_name" label="Nom *" placeholder="Martin" required />
      </div>

      <InputField name="email" label="Email *" type="email" placeholder="claire@cabinet.fr" required />

      <div className="grid grid-cols-2 gap-3">
        <InputField name="phone" label="Téléphone" type="tel" placeholder="+33 6 00 00 00 00" />
        <InputField name="linkedin_url" label="LinkedIn" placeholder="linkedin.com/in/..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField name="company_name" label="Entreprise" placeholder="Cabinet Coaching Lyon" />
        <InputField name="city" label="Ville" placeholder="Lyon" />
      </div>

      <InputField name="call_date" label="Date du call" type="datetime-local" />

      {/* Moyen de contact */}
      <div>
        <label className="block text-xs text-neutral-500 mb-2">Moyen de contact</label>
        <div className="flex flex-wrap gap-2">
          {(['WhatsApp', 'SMS', 'Mail', 'LinkedIn'] as const).map((means) => {
            const val = means.toLowerCase()
            const active = contactMeans.includes(val)
            return (
              <button
                key={means}
                type="button"
                onClick={() => toggleMean(val)}
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

      {/* Commentaire */}
      <div>
        <label className="block text-xs text-neutral-500 mb-1">Commentaire</label>
        <textarea
          name="comment"
          rows={2}
          placeholder="Commentaire rapide..."
          className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}

function InputField({
  name,
  label,
  placeholder,
  type = 'text',
  required,
}: {
  name: string
  label: string
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
      />
    </div>
  )
}
