'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BookPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const data = {
      first_name: (form.elements.namedItem('first_name') as HTMLInputElement).value,
      last_name: (form.elements.namedItem('last_name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company_name: (form.elements.namedItem('company_name') as HTMLInputElement).value,
      city: (form.elements.namedItem('city') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      call_date: (form.elements.namedItem('call_date') as HTMLInputElement).value || null,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Une erreur est survenue')
        setLoading(false)
        return
      }
      router.push('/book/confirmation')
    } catch {
      setError('Une erreur est survenue. Réessayez.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium text-neutral-400 tracking-widest uppercase mb-3">Koj²a</p>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
            Réserver un call de 30 min
          </h1>
          <p className="text-sm text-neutral-500">
            On discute de votre prospection et de comment Koj²a peut vous aider.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Prénom *</label>
              <input
                name="first_name"
                required
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Claire"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nom *</label>
              <input
                name="last_name"
                required
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Martin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email *</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              placeholder="claire@cabinet-coaching.fr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Cabinet / entreprise</label>
              <input
                name="company_name"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Cabinet Coaching Lyon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Ville</label>
              <input
                name="city"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Lyon"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Téléphone</label>
              <input
                name="phone"
                type="tel"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="06 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Date souhaitée</label>
              <input
                name="call_date"
                type="datetime-local"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Votre contexte (optionnel)</label>
            <textarea
              name="message"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              placeholder="Ex : coach depuis 3 ans, je travaille avec des dirigeants de PME industrielles en région lyonnaise..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Envoi en cours...' : 'Réserver le call'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Vous recevrez une confirmation par email sous 24h.
        </p>
      </div>
    </div>
  )
}
