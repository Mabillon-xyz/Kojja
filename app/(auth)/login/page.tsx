'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900">Koj²a</h1>
          <p className="text-neutral-500 text-sm mt-1">Connectez-vous à votre espace</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mot de passe</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-neutral-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="text-center text-sm text-neutral-500">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="text-neutral-900 font-medium hover:underline">Créer un compte</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
