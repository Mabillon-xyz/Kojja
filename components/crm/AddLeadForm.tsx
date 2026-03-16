'use client'
import { useState, useTransition, useRef } from 'react'
import { createLead } from '@/app/actions/leads'

export default function AddLeadForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createLead(formData)
        formRef.current?.reset()
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
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Prénom *</label>
          <input
            name="first_name"
            required
            placeholder="Claire"
            className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Nom *</label>
          <input
            name="last_name"
            required
            placeholder="Martin"
            className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Email *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="claire@cabinet.fr"
          className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Entreprise</label>
          <input
            name="company_name"
            placeholder="Cabinet Coaching Lyon"
            className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Ville</label>
          <input
            name="city"
            placeholder="Lyon"
            className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Date du call</label>
        <input
          name="call_date"
          type="datetime-local"
          className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
